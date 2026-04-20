/**
 * Billing Routes
 * Stripe Checkout / Customer Portal / Webhook
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type Stripe from 'stripe';
import {
  getStripe,
  isStripeConfigured,
  getProPriceId,
  getSubscriptionPriceId,
  getWebhookSecret,
  getMeteredPriceIds,
  type SubscribablePlanId,
} from '../billing/stripe.js';
import { TEAM_MIN_SEATS, PLANS, type PlanType } from '../plans/index.js';
import {
  getStripeCustomerId,
  setStripeCustomerId,
  getWorkspaceByStripeCustomer,
  setSubscriptionStatus,
  getSubscriptionStatus,
  setDefaultPaymentMethod,
} from '../billing/storage.js';
import { resolveWorkspaceId } from './tools/_shared.js';
import { updateWorkspacePlan, getWorkspacePlan } from '../plans/storage.js';

/**
 * Stripe Checkout / Webhook で扱えるプラン識別子
 * Free は ¥0 のため Subscription を作らない.
 * Enterprise は個別見積 (営業経由) のため Checkout フロー対象外.
 */
const CHECKOUTABLE_PLANS: readonly SubscribablePlanId[] = ['pro', 'team', 'max'];

function isCheckoutablePlan(planType: string): planType is SubscribablePlanId {
  return (CHECKOUTABLE_PLANS as readonly string[]).includes(planType);
}

export default async function billingRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /api/billing/status
   * 現在の決済ステータスを取得
   */
  fastify.get('/api/billing/status', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isStripeConfigured()) {
      return reply.send({
        configured: false,
        message: 'Stripe is not configured',
      });
    }

    const workspaceId = request.workspace?.workspaceId || 'default';
    const plan = await getWorkspacePlan(workspaceId);
    const customerId = await getStripeCustomerId(workspaceId);
    const subscription = await getSubscriptionStatus(workspaceId);

    return reply.send({
      configured: true,
      planType: plan.planType,
      hasCustomer: !!customerId,
      subscription: subscription || null,
    });
  });

  /**
   * POST /api/billing/checkout
   * Stripe Checkout Session を作成.
   *
   * Body:
   *   planType?: 'pro' | 'team' | 'max'  (既定: 'pro')
   *   seats?: number                      (team のみ使用, 未指定時は TEAM_MIN_SEATS)
   *
   * Free / Enterprise は Checkout 対象外:
   *   - Free は ¥0 のため Subscription を作らない
   *   - Enterprise は営業経由 (お問い合わせ) で契約
   */
  fastify.post<{
    Body?: { planType?: string; seats?: number };
  }>('/api/billing/checkout', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isStripeConfigured()) {
      return reply.code(400).send({ error: 'Stripe が設定されていません' });
    }

    const workspaceId = request.workspace?.workspaceId || 'default';
    const userEmail = request.user?.email;

    // Body parse (デフォルト: pro)
    const body = (request.body as { planType?: string; seats?: number } | undefined) ?? {};
    const requestedPlan: string = body.planType ?? 'pro';

    if (!isCheckoutablePlan(requestedPlan)) {
      return reply.code(400).send({
        error: 'planType は pro, team, max のいずれかを指定してください (enterprise はお問い合わせください)',
      });
    }
    const planId: SubscribablePlanId = requestedPlan;

    // Team の seats バリデーション
    let seats = TEAM_MIN_SEATS;
    if (planId === 'team') {
      const requestedSeats = typeof body.seats === 'number' ? Math.floor(body.seats) : TEAM_MIN_SEATS;
      if (requestedSeats < TEAM_MIN_SEATS) {
        return reply.code(400).send({
          error: `Team プランの最低席数は ${TEAM_MIN_SEATS} 席です`,
        });
      }
      seats = requestedSeats;
    }

    // 既に同じプランの場合はエラー
    const currentPlan = await getWorkspacePlan(workspaceId);
    if (currentPlan.planType === planId) {
      return reply.code(400).send({
        error: `既に${PLANS[planId].nameJa}プランを利用中です`,
      });
    }
    if (currentPlan.planType === 'enterprise') {
      return reply.code(400).send({
        error: 'Enterpriseプランの変更はお問い合わせください',
      });
    }

    // Price ID 取得
    const priceId = planId === 'pro' ? getProPriceId() : getSubscriptionPriceId(planId);
    if (!priceId) {
      return reply.code(503).send({
        error: `${PLANS[planId].nameJa}プランの Stripe Price ID が未設定です (env: STRIPE_${planId.toUpperCase()}_PRICE_ID)`,
      });
    }

    try {
      const stripe = getStripe();
      let customerId = await getStripeCustomerId(workspaceId);

      // Stripe Customer がなければ作成
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: userEmail || undefined,
          metadata: {
            workspaceId,
          },
        });
        customerId = customer.id;
        await setStripeCustomerId(workspaceId, customerId);
      }

      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

      // Checkout Session 作成（固定料金 + 従量課金アイテム）
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
        {
          price: priceId,
          // Team は seat 課金 (quantity = seats)
          quantity: planId === 'team' ? seats : 1,
        },
      ];

      // 従量課金の Price が設定されていれば追加（metered items は quantity 不要）
      const meteredPrices = getMeteredPriceIds(planId);
      if (meteredPrices.traceOveragePriceId) {
        lineItems.push({ price: meteredPrices.traceOveragePriceId });
      }
      if (meteredPrices.evalOveragePriceId) {
        lineItems.push({ price: meteredPrices.evalOveragePriceId });
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: lineItems,
        success_url: `${baseUrl}/?tab=plan&checkout=success`,
        cancel_url: `${baseUrl}/?tab=plan&checkout=cancel`,
        metadata: {
          workspaceId,
          planType: planId,
          ...(planId === 'team' ? { seats: String(seats) } : {}),
        },
        subscription_data: {
          metadata: {
            workspaceId,
            planType: planId,
            ...(planId === 'team' ? { seats: String(seats) } : {}),
          },
        },
      });

      return reply.send({
        checkoutUrl: session.url,
        sessionId: session.id,
        planType: planId,
        ...(planId === 'team' ? { seats } : {}),
      });
    } catch (error) {
      console.error('[Billing] Checkout Session作成失敗:', error);
      return reply.code(500).send({
        error: 'Checkout Session の作成に失敗しました',
      });
    }
  });

  /**
   * POST /api/billing/portal
   * Stripe Customer Portal Session を作成（プラン管理）
   */
  fastify.post('/api/billing/portal', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isStripeConfigured()) {
      return reply.code(400).send({ error: 'Stripe が設定されていません' });
    }

    const workspaceId = request.workspace?.workspaceId || 'default';
    const customerId = await getStripeCustomerId(workspaceId);

    if (!customerId) {
      return reply.code(400).send({ error: 'Stripe Customer が見つかりません' });
    }

    try {
      const stripe = getStripe();
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${baseUrl}/?tab=plan`,
      });

      return reply.send({
        portalUrl: session.url,
      });
    } catch (error) {
      console.error('[Billing] Portal Session作成失敗:', error);
      return reply.code(500).send({
        error: 'Portal Session の作成に失敗しました',
      });
    }
  });

  /**
   * POST /api/billing/agent-setup
   * Create a Stripe Checkout Session in setup mode for agent per-use billing.
   * Request: (no body required)
   * Response: { setupUrl: string }
   */
  fastify.post('/api/billing/agent-setup', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isStripeConfigured()) {
      return reply.code(503).send({ error: 'Stripe is not configured' });
    }

    const workspaceId = await resolveWorkspaceId(request);
    if (!workspaceId) {
      return reply.code(401).send({ error: '認証が必要です' });
    }

    try {
      const stripe = getStripe();

      // Find or create Stripe customer
      let customerId = await getStripeCustomerId(workspaceId);
      if (!customerId) {
        const userEmail = request.user?.email;
        const customer = await stripe.customers.create({
          email: userEmail || undefined,
          metadata: { workspace_id: workspaceId },
        });
        customerId = customer.id;
        await setStripeCustomerId(workspaceId, customerId);
      }

      const origin = request.headers.origin
        || (request.headers.referer as string | undefined)?.replace(/\/[^/]*$/, '')
        || 'https://www.fujitrace.jp';

      const session = await stripe.checkout.sessions.create({
        mode: 'setup',
        customer: customerId,
        payment_method_types: ['card'],
        success_url: `${origin}/tools/clerk?setup=success`,
        cancel_url: `${origin}/tools/clerk?setup=cancel`,
        metadata: {
          workspace_id: workspaceId,
          purpose: 'agent_per_use',
        },
      });

      return reply.send({ setupUrl: session.url });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error({ err: error }, '[Billing] Agent setup session creation failed');
      return reply.code(500).send({ error: `セットアップセッションの作成に失敗しました: ${message}` });
    }
  });

  /**
   * POST /api/billing/webhook
   * Stripe Webhook 受信
   * 重要: raw body が必要（署名検証のため）
   */
  fastify.post('/api/billing/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!isStripeConfigured()) {
      return reply.code(400).send({ error: 'Stripe is not configured' });
    }

    const sig = request.headers['stripe-signature'] as string;
    if (!sig) {
      return reply.code(400).send({ error: 'Missing stripe-signature header' });
    }

    let event;
    try {
      const stripe = getStripe();
      const rawBody = (request as unknown as { rawBody?: string | Buffer }).rawBody;
      if (!rawBody) {
        return reply.code(400).send({ error: 'Raw body is required for webhook verification' });
      }
      event = stripe.webhooks.constructEvent(rawBody, sig, getWebhookSecret());
    } catch (err) {
      console.error('[Billing] Webhook署名検証失敗:', err);
      return reply.code(400).send({
        error: `Webhook verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const workspaceId = session.metadata?.workspaceId;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;
          // metadata.planType を優先. 未指定は後方互換で 'pro' とみなす.
          const metaPlanType = session.metadata?.planType;
          const planType: PlanType = isCheckoutablePlan(metaPlanType ?? '')
            ? (metaPlanType as PlanType)
            : 'pro';
          // Team の seats は metadata 文字列で保存している
          const metaSeats = session.metadata?.seats;
          const seats = metaSeats ? Number.parseInt(metaSeats, 10) : undefined;

          if (workspaceId && session.mode === 'subscription') {
            // Customer マッピング保存
            await setStripeCustomerId(workspaceId, customerId);

            // プランを checkout で指定されたものに自動切替
            await updateWorkspacePlan(workspaceId, planType, {
              subscriptionId,
              ...(planType === 'team' && Number.isFinite(seats) ? { seats } : {}),
            });

            // ステータス保存
            await setSubscriptionStatus(workspaceId, 'active', subscriptionId);

            fastify.log.info(
              { workspaceId, subscriptionId, planType, seats },
              'Checkout completed (subscription)',
            );
          }

          // Handle setup mode sessions (payment method collection for agent per-use)
          if (session.mode === 'setup' && session.setup_intent) {
            const stripe = getStripe();
            const setupIntentId = typeof session.setup_intent === 'string'
              ? session.setup_intent
              : session.setup_intent.id;
            const setupIntent = await stripe.setupIntents.retrieve(setupIntentId);

            if (setupIntent.payment_method) {
              const paymentMethodId = typeof setupIntent.payment_method === 'string'
                ? setupIntent.payment_method
                : setupIntent.payment_method.id;
              const wsId = session.metadata?.workspace_id;
              if (wsId) {
                await setDefaultPaymentMethod(wsId, paymentMethodId);
                fastify.log.info({ workspaceId: wsId }, 'Agent per-use payment method saved');
              }
            }
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;
          const workspaceId = await getWorkspaceByStripeCustomer(customerId);

          if (workspaceId) {
            const status = subscription.status as 'active' | 'past_due' | 'canceled' | 'unpaid';
            await setSubscriptionStatus(workspaceId, status, subscription.id);

            if (status === 'active') {
              // subscription.metadata から planType を復元. 旧データ (planType 未設定) は pro とみなす.
              const metaPlanType = subscription.metadata?.planType;
              const planType: PlanType = isCheckoutablePlan(metaPlanType ?? '')
                ? (metaPlanType as PlanType)
                : 'pro';
              const metaSeats = subscription.metadata?.seats;
              const seats = metaSeats ? Number.parseInt(metaSeats, 10) : undefined;

              await updateWorkspacePlan(workspaceId, planType, {
                subscriptionId: subscription.id,
                ...(planType === 'team' && Number.isFinite(seats) ? { seats } : {}),
              });
            }

            console.log(`[Billing] サブスクリプション更新: workspace=${workspaceId}, status=${status}`);
          }
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          const customerId = subscription.customer as string;
          const workspaceId = await getWorkspaceByStripeCustomer(customerId);

          if (workspaceId) {
            // Freeプランにダウングレード
            await updateWorkspacePlan(workspaceId, 'free');
            await setSubscriptionStatus(workspaceId, 'canceled', subscription.id);

            console.log(`[Billing] サブスクリプション解約: workspace=${workspaceId}`);
          }
          break;
        }

        case 'invoice.payment_succeeded': {
          const successInvoice = event.data.object;
          const successCustomerId = successInvoice.customer as string;
          const successWorkspaceId = await getWorkspaceByStripeCustomer(successCustomerId);

          if (successWorkspaceId) {
            console.log(
              `[Billing] 請求書支払い成功: workspace=${successWorkspaceId}, invoice=${successInvoice.id}, amount=${successInvoice.amount_paid}`
            );
          }
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          const customerId = invoice.customer as string;
          const workspaceId = await getWorkspaceByStripeCustomer(customerId);

          if (workspaceId) {
            console.warn(
              `[Billing] 支払い失敗: workspace=${workspaceId}, invoice=${invoice.id}, amount=${invoice.amount_due}`
            );
            // TODO: 管理者にメール通知
          }
          break;
        }

        default:
          console.log(`[Billing] 未処理のイベント: ${event.type}`);
      }
    } catch (error) {
      console.error(`[Billing] Webhook処理失敗 (${event.type}):`, error);
      // Stripe に再送を促すため 500 を返す
      return reply.code(500).send({ error: 'Webhook processing failed' });
    }

    return reply.send({ received: true });
  });
}
