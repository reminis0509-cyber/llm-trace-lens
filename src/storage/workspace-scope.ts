/**
 * storage/workspace-scope.ts — scope widening helpers for Team/Enterprise plans.
 *
 * For individual plans (free/pro/max) the AI Employee state is always
 * scoped by `user_id`. For Team/Enterprise plans we ALSO want to surface
 * rows that belong to other workspace members when their `workspace_id`
 * matches the caller's active workspace.
 *
 * Usage:
 *   const resolver = await resolveScope(userEmail, workspaceId);
 *   const rows = await applyScope(db('task_timeline'), resolver).limit(50);
 *
 * `applyScope` is non-destructive — it simply adds a WHERE clause.
 */
import type { Knex } from 'knex';
import { getWorkspacePlan } from '../plans/storage.js';
import type { PlanType } from '../plans/index.js';

export interface WorkspaceScope {
  userId: string;
  workspaceId: string | null;
  planType: PlanType;
  /** True when the caller's plan allows reading other members' rows. */
  shared: boolean;
}

const SHARED_PLANS: readonly PlanType[] = ['team', 'enterprise'];

export async function resolveScope(
  userId: string,
  workspaceId: string | null,
): Promise<WorkspaceScope> {
  if (!workspaceId) {
    return { userId, workspaceId: null, planType: 'free', shared: false };
  }
  const plan = await getWorkspacePlan(workspaceId);
  const shared = SHARED_PLANS.includes(plan.planType);
  return { userId, workspaceId, planType: plan.planType, shared };
}

/**
 * Adds a WHERE clause that matches:
 *   - rows belonging to the user (user_id = userId), AND/OR
 *   - on shared plans only: rows whose workspace_id matches the caller's
 *     current workspace AND whose user_id is set (any member).
 *
 * Tables must have a `workspace_id` column for the shared widening to
 * apply; migration 016 backfills this column on all v1 and v2 tables.
 */
export function applyScope(
  query: Knex.QueryBuilder,
  scope: WorkspaceScope,
): Knex.QueryBuilder {
  if (!scope.shared || !scope.workspaceId) {
    return query.where('user_id', scope.userId);
  }
  const wsId = scope.workspaceId;
  return query.where((b) =>
    b.where('user_id', scope.userId).orWhere('workspace_id', wsId),
  );
}
