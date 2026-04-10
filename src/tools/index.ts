/**
 * FujiTrace AI Tools — orchestration-layer registry.
 *
 * This module is the aggregation point for every responsible AI tool's
 * `ToolSchema`. The FujiTrace AI 事務員 (Scaffolded Agent) and the
 * OpenAPI route handler both consume this registry, so adding a new tool
 * here means a single import + array push.
 */
export * from './types.js';
export * from './openapi-converter.js';
export { estimateToolSchemas } from './estimate/index.js';
export { officeTaskSchemas, officeTaskCatalog, type OfficeTaskEntry } from './office-tasks/index.js';

import { estimateToolSchemas } from './estimate/index.js';
import { officeTaskSchemas } from './office-tasks/index.js';
import type { ToolSchema } from './types.js';

export const allToolSchemas: ToolSchema[] = [...estimateToolSchemas, ...officeTaskSchemas];
