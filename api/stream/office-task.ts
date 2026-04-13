/**
 * POST /api/stream/office-task
 *
 * Vercel Web Standard function that streams skeleton trace steps via SSE.
 * Uses ReadableStream for true streaming (no buffering).
 *
 * This endpoint bypasses Fastify and calls the extracted pipeline directly.
 */
import { executeOfficeTaskPipeline, ForbiddenTaskError, ValidationError, TaskNotFoundError } from '../../src/tools/execute-pipeline.js';
import { getKnex } from '../../src/storage/knex-client.js';
import { recordUsage, enforceFreeQuota, ensureAiToolsTables } from '../../src/routes/tools/_shared.js';
import type { SkeletonStep } from '../../src/types/skeleton-trace.js';

async function resolveWorkspaceFromHeaders(headers: Headers): Promise<string | null> {
  const userEmail = headers.get('x-user-email');
  if (!userEmail) return null;
  try {
    const db = getKnex();
    const membership = await db('workspace_users')
      .where({ email: userEmail.toLowerCase() })
      .orderBy('created_at', 'asc')
      .first();
    return (membership?.workspace_id as string) || null;
  } catch {
    return null;
  }
}

function isAdminEmail(headers: Headers): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase());
  const userEmail = (headers.get('x-user-email') || '').toLowerCase();
  return userEmail !== '' && adminEmails.includes(userEmail);
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function POST(request: Request): Promise<Response> {
  // 1. Auth
  const headers = request.headers;
  const workspaceId = await resolveWorkspaceFromHeaders(headers);
  if (!workspaceId) {
    return jsonResponse({ success: false, error: '認証が必要です' }, 401);
  }

  // 2. Parse body
  let body: { task_id: string; instruction: string; context?: Record<string, unknown>; document_text?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: '入力が不正です' }, 400);
  }

  if (!body.task_id || !body.instruction) {
    return jsonResponse({ success: false, error: 'task_id と instruction は必須です' }, 400);
  }

  // 3. Quota check
  await ensureAiToolsTables();
  if (!isAdminEmail(headers)) {
    const quota = await enforceFreeQuota(workspaceId);
    if (!quota.allowed) {
      return jsonResponse({ success: false, error: quota.error }, 429);
    }
  }

  // 4. SSE streaming response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await executeOfficeTaskPipeline({
          taskId: body.task_id,
          instruction: body.instruction,
          context: body.context,
          documentText: body.document_text,
          workspaceId,
          onStep: (step: SkeletonStep) => {
            sendEvent('step', step);
          },
        });

        // Record usage
        await recordUsage(workspaceId, body.task_id.split('.')[0], body.task_id.split('.').slice(1).join('.') || 'execute', result.traceId);

        // Send final result
        sendEvent('done', {
          success: true,
          data: {
            task_id: result.taskId,
            task_name: result.taskName,
            archetype: result.archetype,
            result: result.result,
            structured_result: result.structuredResult,
            arithmetic_check: result.arithmeticCheck,
            validation_warnings: result.validationWarnings,
            caution_note: result.cautionNote,
            trace_id: result.traceId,
            skeleton_trace: result.skeletonTrace,
          },
        });
      } catch (err) {
        if (err instanceof ForbiddenTaskError) {
          sendEvent('error', { error: err.message });
        } else if (err instanceof ValidationError) {
          sendEvent('error', { error: err.message });
        } else if (err instanceof TaskNotFoundError) {
          sendEvent('error', { error: err.message });
        } else {
          const message = err instanceof Error ? err.message : String(err);
          sendEvent('error', { error: `処理中にエラーが発生しました: ${message}` });
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
