/**
 * Unit tests for src/routes/tools/market-rates.ts
 */
import { describe, it, expect } from 'vitest';
import {
  MARKET_RATES,
  formatMarketRatesForPrompt,
} from '../../../routes/tools/market-rates.js';

describe('MARKET_RATES', () => {
  it('has non-empty entries', () => {
    expect(Object.keys(MARKET_RATES).length).toBeGreaterThan(0);
  });

  it('each entry has min <= max', () => {
    for (const [industry, rate] of Object.entries(MARKET_RATES)) {
      expect(rate.min, `${industry} min`).toBeLessThanOrEqual(rate.max);
      expect(rate.min, `${industry} min`).toBeGreaterThan(0);
    }
  });

  it('each entry has a unit string', () => {
    for (const [industry, rate] of Object.entries(MARKET_RATES)) {
      expect(typeof rate.unit, industry).toBe('string');
      expect(rate.unit.length, industry).toBeGreaterThan(0);
    }
  });
});

describe('formatMarketRatesForPrompt', () => {
  it('returns all rates when industry not specified', () => {
    const out = formatMarketRatesForPrompt();
    const parsed = JSON.parse(out);
    expect(Object.keys(parsed).length).toBe(Object.keys(MARKET_RATES).length);
  });

  it('returns only matching entry when industry specified', () => {
    const out = formatMarketRatesForPrompt('システム開発');
    const parsed = JSON.parse(out);
    expect(Object.keys(parsed)).toEqual(['システム開発']);
    expect(parsed['システム開発'].unit).toBe('人日');
  });

  it('falls back to all rates for unknown industry', () => {
    const out = formatMarketRatesForPrompt('NotARealIndustry');
    const parsed = JSON.parse(out);
    expect(Object.keys(parsed).length).toBe(Object.keys(MARKET_RATES).length);
  });

  it('returns valid JSON that the prompt template can embed', () => {
    const out = formatMarketRatesForPrompt('デザイン');
    // Should be parseable and should not contain any unescaped characters
    // that would break a JSON-embedded prompt.
    expect(() => JSON.parse(out)).not.toThrow();
  });
});
