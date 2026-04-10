/**
 * Barrel re-export for the office tasks orchestration metadata.
 */
export { officeTaskCatalog, type OfficeTaskEntry } from './catalog.js';
export { officeTaskSchemas } from './schema.js';
export {
  type ArchetypeId,
  type ArchetypeField,
  type ValidationRule,
  type ArchetypeDefinition,
  archetypeDefinitions,
  getArchetype,
} from './archetypes.js';
export {
  type ValidationIssue,
  validateInput,
  validateOutput,
} from './validator.js';
