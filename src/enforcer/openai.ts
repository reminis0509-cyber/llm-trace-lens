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
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

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
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      })));
    } else if (request.prompt) {
      messages.push({
        role: 'user',
        content: request.prompt
      });
    }

    const model = request.model || 'gpt-4o-mini';

    // Non-streaming request
    const completion = await this.client.chat.completions.create({
      model,
      messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: false,
      ...(supportsJsonMode(model) && { response_format: { type: 'json_object' } }),
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from OpenAI API');
    }

    let structured: StructuredResponse;
    try {
      structured = JSON.parse(content);
    } catch {
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
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

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
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      })));
    } else if (request.prompt) {
      messages.push({
        role: 'user',
        content: request.prompt
      });
    }

    const model = request.model || 'gpt-4o-mini';

    // Streaming request
    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stream: true,
      ...(supportsJsonMode(model) && { response_format: { type: 'json_object' } }),
    });

    let fullContent = '';

    // Type guard: check if it's actually a stream
    if (Symbol.asyncIterator in stream) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullContent += delta;
          yield delta;
        }
      }
    }

    // Generate final structured response
    let structured: StructuredResponse;
    try {
      structured = JSON.parse(fullContent);
    } catch {
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
