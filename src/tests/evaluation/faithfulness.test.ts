import { describe, it, expect, beforeEach } from 'vitest';

// Import the types directly to test the interface
import type { EvaluationResult, EvaluationInput } from '../../evaluation/types.js';

describe('EvaluationResult type', () => {
  it('should have all required fields', () => {
    const result: EvaluationResult = {
      faithfulness: 0.9,
      answerRelevance: 0.8,
      contextUtilization: null,
      hallucinationRate: null,
      isRAG: false,
      evaluatedAt: new Date().toISOString(),
      evaluationModel: 'gpt-4o-mini',
    };

    expect(result.faithfulness).toBe(0.9);
    expect(result.answerRelevance).toBe(0.8);
    expect(result.isRAG).toBe(false);
    expect(result.evaluatedAt).toBeDefined();
    expect(result.evaluationModel).toBe('gpt-4o-mini');
  });

  it('should allow null values for scores', () => {
    const result: EvaluationResult = {
      faithfulness: null,
      answerRelevance: null,
      contextUtilization: null,
      hallucinationRate: null,
      isRAG: false,
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
      contextUtilization: null,
      hallucinationRate: null,
      isRAG: false,
      evaluatedAt: new Date().toISOString(),
      evaluationModel: 'gpt-4o-mini',
      error: 'API key missing',
    };

    expect(result.error).toBe('API key missing');
  });

  it('should support RAG evaluation fields', () => {
    const result: EvaluationResult = {
      faithfulness: 0.95,
      answerRelevance: 0.88,
      contextUtilization: 0.72,
      hallucinationRate: 0.05,
      isRAG: true,
      evaluatedAt: new Date().toISOString(),
      evaluationModel: 'openai/gpt-4o-mini',
    };

    expect(result.isRAG).toBe(true);
    expect(result.contextUtilization).toBe(0.72);
    expect(result.hallucinationRate).toBe(0.05);
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

  it('should throw when no API key is set', async () => {
    const savedOpenAI = process.env.OPENAI_API_KEY;
    const savedAnthropic = process.env.ANTHROPIC_API_KEY;
    const savedProvider = process.env.EVALUATION_PROVIDER;

    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.EVALUATION_PROVIDER;

    try {
      const { evaluateTrace } = await import('../../evaluation/index.js');

      await expect(
        evaluateTrace({ question: 'test', answer: 'test' })
      ).rejects.toThrow('OPENAI_API_KEYまたはANTHROPIC_API_KEYが必要です');
    } finally {
      // Restore environment variables to avoid polluting other tests
      if (savedOpenAI !== undefined) process.env.OPENAI_API_KEY = savedOpenAI;
      else delete process.env.OPENAI_API_KEY;

      if (savedAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = savedAnthropic;
      else delete process.env.ANTHROPIC_API_KEY;

      if (savedProvider !== undefined) process.env.EVALUATION_PROVIDER = savedProvider;
      else delete process.env.EVALUATION_PROVIDER;
    }
  });
});
