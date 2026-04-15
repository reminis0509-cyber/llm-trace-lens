import { describe, it, expect } from 'vitest';
import { officeTaskCatalog } from '../../tools/office-tasks/catalog.js';

describe('officeTaskCatalog: accounting.estimate_check', () => {
  it('contains an entry with id accounting.estimate_check', () => {
    const entry = officeTaskCatalog.find(t => t.id === 'accounting.estimate_check');
    expect(entry).toBeDefined();
  });

  it('uses the document_check archetype', () => {
    const entry = officeTaskCatalog.find(t => t.id === 'accounting.estimate_check');
    expect(entry?.archetype).toBe('document_check');
  });

  it('is not forbidden and is classified as high responsibility', () => {
    const entry = officeTaskCatalog.find(t => t.id === 'accounting.estimate_check');
    expect(entry?.forbidden).toBe(false);
    expect(entry?.responsibilityLevel).toBe('high');
  });
});
