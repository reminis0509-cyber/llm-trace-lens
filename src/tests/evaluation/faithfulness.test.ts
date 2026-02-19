import { describe, it, expect, beforeEach } from 'vitest';

// Import the types directly to test the interface
import type { EvaluationResult, EvaluationInput } from '../../evaluation/types.js';

describe('EvaluationResult type', () => {
  it('should have all required fields', () => {
    const result: EvaluationResult = {
      faithfulness: 0.9,
      answerRelevance: 0.8,
      evaluatedAt: new Date().toISOString(),
      evaluationModel: 'gpt-4o-mini',
    };

    expect(result.faithfulness).toBe(0.9);
    expect(result.answerRelevance).toBe(0.8);
    expect(result.evaluatedAt).toBeDefined();
    expect(result.evaluationModel).toBe('gpt-4o-mini');
  });

  it('should allow null values for scores', () => {
    const result: EvaluationResult = {
      faithfulness: null,
      answerRelevance: null,
      evaluatedAt: new Date().toISOString(),
      evaluationModel: 'gpt-4o-mini',
    };

    expect(result.faithfulness).toBeNull();
    expect(result.answerRelevance).toBeNull();
  });

  it('should allow optional error field', () => {
    const result: EvaluationResult = {
      faithfulness: null,
      answerRelevance: null,
      evaluatedAt: new Date().toISOString(),
      evaluationModel: 'gpt-4o-mini',
      error: 'API key missing',
    };

    expect(result.error).toBe('API key missing');
  });
});

describe('EvaluationInput type', () => {
  it('should require question and answer', () => {
    const input: EvaluationInput = {
      question: 'What is the capital of France?',
      answer: 'Paris is the capital of France.',
    };

    expect(input.question).toBe('What is the capital of France?');
    expect(input.answer).toBe('Paris is the capital of France.');
    expect(input.context).toBeUndefined();
  });

  it('should allow optional context', () => {
    const input: EvaluationInput = {
      question: 'What is the capital of France?',
      answer: 'Paris is the capital of France.',
      context: 'France is a country in Europe. Its capital is Paris.',
    };

    expect(input.context).toBe('France is a country in Europe. Its capital is Paris.');
  });
});

describe('evaluateTrace function structure', () => {
  beforeEach(() => {
    // Reset environment
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('should export evaluateTrace function', async () => {
    const module = await import('../../evaluation/index.js');
    expect(typeof module.evaluateTrace).toBe('function');
  });

  it('should return EvaluationResult structure without API key', async () => {
    delete process.env.OPENAI_API_KEY;

    const { evaluateTrace } = await import('../../evaluation/index.js');

    const result = await evaluateTrace({
      question: 'test',
      answer: 'test',
    });

    // Should return valid structure even without API key
    expect(result).toHaveProperty('faithfulness');
    expect(result).toHaveProperty('answerRelevance');
    expect(result).toHaveProperty('evaluatedAt');
    expect(result).toHaveProperty('evaluationModel');
  });
});
