import OpenAI from 'openai';
import type { LLMRequest, StructuredResponse } from '../types/index.js';

// Models that support response_format: { type: 'json_object' }
const JSON_MODE_SUPPORTED_MODELS = [
  'gpt-4-turbo',
  'gpt-4-turbo-preview',
  'gpt-4-turbo-2024-04-09',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4o-2024-05-13',
  'gpt-4o-2024-08-06',
  'gpt-4o-mini-2024-07-18',
  'gpt-3.5-turbo-1106',
  'gpt-3.5-turbo-0125',
];

function supportsJsonMode(model: string): boolean {
  return JSON_MODE_SUPPORTED_MODELS.some(supported =>
    model.toLowerCase().includes(supported.toLowerCase())
  );
}

export class OpenAIEnforcer {
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('OPENAI_API_KEY is required for OpenAI provider');
    }
    this.client = new OpenAI({ apiKey });
  }

  async enforce(request: LLMRequest): Promise<StructuredResponse> {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      });
    }

    messages.push({
      role: 'system',
      content: 'You must respond with a valid JSON object containing: "answer" (your response), "confidence" (0-100), "evidence" (array of facts), "alternatives" (array of alternative answers).'
    });

    if (request.messages && request.messages.length > 0) {
      messages.push(...request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
    } else if (request.prompt) {
      messages.push({
        role: 'user',
        content: request.prompt
      });
    }

    const model = request.model || 'gpt-4o-mini';
    const requestParams: Parameters<typeof this.client.chat.completions.create>[0] = {
      model,
      messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
    };

    // Only add response_format for models that support it
    if (supportsJsonMode(model)) {
      requestParams.response_format = { type: 'json_object' };
    }

    const completion = await this.client.chat.completions.create(requestParams);

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    let structured: StructuredResponse;
    try {
      structured = JSON.parse(content);
    } catch (parseError) {
      structured = {
        answer: content,
        confidence: 50,
        evidence: ['Raw response - could not parse structured format'],
        alternatives: []
      };
    }

    if (!structured.answer) structured.answer = content;
    if (typeof structured.confidence !== 'number') structured.confidence = 50;
    if (!Array.isArray(structured.evidence)) structured.evidence = [];
    if (!Array.isArray(structured.alternatives)) structured.alternatives = [];

    return structured;
  }

  async *enforceStream(request: LLMRequest): AsyncGenerator<string, StructuredResponse, unknown> {
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt
      });
    }

    messages.push({
      role: 'system',
      content: 'You must respond with a valid JSON object containing: "answer" (your response), "confidence" (0-100), "evidence" (array of facts), "alternatives" (array of alternative answers).'
    });

    if (request.messages && request.messages.length > 0) {
      messages.push(...request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
    } else if (request.prompt) {
      messages.push({
        role: 'user',
        content: request.prompt
      });
    }

    const model = request.model || 'gpt-4o-mini';
    const requestParams: Parameters<typeof this.client.chat.completions.create>[0] = {
      model,
      messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
    };

    // Only add response_format for models that support it
    if (supportsJsonMode(model)) {
      requestParams.response_format = { type: 'json_object' };
    }

    const stream = await this.client.chat.completions.create(requestParams);

    let fullContent = '';

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content || '';
      if (delta) {
        fullContent += delta;
        yield delta;
      }
    }

    // 最終的な構造化レスポンスを生成
    let structured: StructuredResponse;
    try {
      structured = JSON.parse(fullContent);
    } catch (parseError) {
      structured = {
        answer: fullContent,
        confidence: 50,
        evidence: ['Raw response - could not parse structured format'],
        alternatives: []
      };
    }

    if (!structured.answer) structured.answer = fullContent;
    if (typeof structured.confidence !== 'number') structured.confidence = 50;
    if (!Array.isArray(structured.evidence)) structured.evidence = [];
    if (!Array.isArray(structured.alternatives)) structured.alternatives = [];

    return structured;
  }
}
