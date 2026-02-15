import OpenAI from 'openai';
import type { LLMRequest, StructuredResponse } from '../types/index.js';

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

    const completion = await this.client.chat.completions.create({
      model: request.model || 'gpt-4',
      messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      response_format: { type: 'json_object' }
    });

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

    const stream = await this.client.chat.completions.create({
      model: request.model || 'gpt-4',
      messages: messages as Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      response_format: { type: 'json_object' },
      stream: true
    });

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
