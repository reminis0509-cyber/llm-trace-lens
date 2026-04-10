/**
 * Input/output validation for office task archetypes.
 *
 * - `validateInput` checks user-supplied data against archetype + task rules
 *   before the LLM call.
 * - `validateOutput` parses the raw LLM response into a structured object
 *   matching the archetype's output fields.
 */
import type { ArchetypeDefinition, ValidationRule } from './archetypes.js';

// ── Input validation ────────────────────────────────────────────────

export interface ValidationIssue {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Validate input data against a list of validation rules.
 * Returns an empty array if all checks pass.
 */
export function validateInput(
  data: Record<string, unknown>,
  rules: ValidationRule[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const rule of rules) {
    const value = data[rule.field];

    switch (rule.rule) {
      case 'required': {
        if (value === undefined || value === null || value === '') {
          issues.push({ field: rule.field, message: rule.message, severity: 'error' });
        }
        break;
      }

      case 'positive_number': {
        if (value !== undefined && value !== null && value !== '') {
          const num = Number(value);
          if (Number.isNaN(num) || num <= 0) {
            issues.push({ field: rule.field, message: rule.message, severity: 'error' });
          }
        }
        break;
      }

      case 'date_format': {
        if (value !== undefined && value !== null && value !== '') {
          const str = String(value);
          const parsed = Date.parse(str);
          if (Number.isNaN(parsed)) {
            issues.push({ field: rule.field, message: rule.message, severity: 'warning' });
          }
        }
        break;
      }

      case 'not_empty_array': {
        if (value !== undefined && value !== null) {
          if (!Array.isArray(value) || value.length === 0) {
            issues.push({ field: rule.field, message: rule.message, severity: 'error' });
          }
        }
        break;
      }

      case 'max_length': {
        const max = (rule.params?.max as number | undefined) ?? Infinity;
        if (typeof value === 'string' && value.length > max) {
          issues.push({ field: rule.field, message: rule.message, severity: 'error' });
        }
        break;
      }

      case 'min_length': {
        const min = (rule.params?.min as number | undefined) ?? 0;
        if (typeof value === 'string' && value.length < min) {
          issues.push({ field: rule.field, message: rule.message, severity: 'error' });
        }
        break;
      }
    }
  }

  return issues;
}

// ── Output validation ───────────────────────────────────────────────

/**
 * Parse and validate the raw LLM JSON response against the archetype output schema.
 *
 * The function is lenient: it extracts JSON from markdown fences,
 * tolerates leading/trailing prose, and coerces field types where possible.
 * Missing required fields are replaced with sensible defaults so the
 * caller always gets a usable object.
 *
 * Throws only when no valid JSON can be extracted at all.
 */
export function validateOutput(
  raw: string,
  archetype: ArchetypeDefinition,
): Record<string, unknown> {
  // 1. Strip markdown fences
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }

  // 2. Find outermost braces
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');

  let parsed: Record<string, unknown>;
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const jsonStr = cleaned.slice(firstBrace, lastBrace + 1);
    parsed = JSON.parse(jsonStr) as Record<string, unknown>;
  } else {
    // No JSON found — wrap the entire text as a fallback result
    const fallbackField = archetype.outputFields.find(f => f.type === 'text')?.name ?? 'result';
    parsed = { [fallbackField]: raw };
  }

  // 3. Ensure required fields exist with defaults
  for (const field of archetype.outputFields) {
    if (field.required && (parsed[field.name] === undefined || parsed[field.name] === null)) {
      switch (field.type) {
        case 'string':
        case 'text':
          parsed[field.name] = '';
          break;
        case 'number':
          parsed[field.name] = 0;
          break;
        case 'boolean':
          parsed[field.name] = false;
          break;
        case 'array':
          parsed[field.name] = [];
          break;
      }
    }
  }

  return parsed;
}
