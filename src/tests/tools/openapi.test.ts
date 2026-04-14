/**
 * Tests for the Design for Orchestration layer:
 *   - src/tools/openapi-converter.ts
 *   - src/tools/estimate/schema.ts
 *
 * These tests intentionally avoid spinning up Fastify. The conversion is a
 * pure function and the tool schemas are pure data, so they can be exercised
 * directly and kept fast.
 */
import { describe, it, expect } from 'vitest';
import {
  toolSchemasToOpenApi,
  type OpenApiDocument,
} from '../../tools/openapi-converter.js';
import { estimateToolSchemas } from '../../tools/estimate/schema.js';

function buildDoc(): OpenApiDocument {
  return toolSchemasToOpenApi(estimateToolSchemas, {
    title: 'FujiTrace Estimate Tool API',
    version: '1.0.0',
    baseUrl: '/',
  });
}

describe('toolSchemasToOpenApi', () => {
  it('produces an OpenAPI 3.1 document with the expected envelope', () => {
    const doc = buildDoc();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.info.title).toBe('FujiTrace Estimate Tool API');
    expect(doc.info.version).toBe('1.0.0');
    expect(Array.isArray(doc.servers)).toBe(true);
    expect(doc.servers.length).toBeGreaterThan(0);
  });

  it('includes the expected estimate tool paths', () => {
    const doc = buildDoc();
    expect(doc.paths['/api/tools/estimate/create']).toBeDefined();
    expect(doc.paths['/api/tools/estimate/check']).toBeDefined();
  });

  it('registers each path under the correct HTTP method', () => {
    const doc = buildDoc();
    const createOp = doc.paths['/api/tools/estimate/create']?.post as
      | Record<string, unknown>
      | undefined;
    const checkOp = doc.paths['/api/tools/estimate/check']?.post as
      | Record<string, unknown>
      | undefined;
    expect(createOp).toBeDefined();
    expect(checkOp).toBeDefined();
    expect(createOp?.operationId).toBe('estimate.create');
    expect(checkOp?.operationId).toBe('estimate.check');
  });

  it('hoists input/output schemas into components.schemas and references them', () => {
    const doc = buildDoc();
    const schemaKeys = Object.keys(doc.components.schemas);
    expect(schemaKeys).toContain('estimate_create_Input');
    expect(schemaKeys).toContain('estimate_create_Output');
    expect(schemaKeys).toContain('estimate_check_Input');
    expect(schemaKeys).toContain('estimate_check_Output');

    const createOp = doc.paths['/api/tools/estimate/create']?.post as
      | Record<string, unknown>
      | undefined;
    const body = createOp?.requestBody as
      | { content: { 'application/json': { schema: { $ref: string } } } }
      | undefined;
    expect(body?.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/estimate_create_Input',
    );
  });

  it('carries tool metadata (version + description) on each operation', () => {
    const doc = buildDoc();
    const createOp = doc.paths['/api/tools/estimate/create']?.post as
      | Record<string, unknown>
      | undefined;
    expect(createOp?.['x-tool-version']).toBe('1.0.0');
    expect(typeof createOp?.summary).toBe('string');
    expect(((createOp?.summary as string) ?? '').length).toBeGreaterThan(10);
  });
});

describe('estimateToolSchemas', () => {
  it('exposes two tools with stable names and versions', () => {
    expect(estimateToolSchemas).toHaveLength(2);
    const names = estimateToolSchemas.map((t) => t.name).sort();
    expect(names).toEqual(['estimate.check', 'estimate.create']);
    for (const t of estimateToolSchemas) {
      expect(t.version).toBe('1.0.0');
      expect(t.inputSchema).toBeTypeOf('object');
      expect(t.outputSchema).toBeTypeOf('object');
    }
  });
});
