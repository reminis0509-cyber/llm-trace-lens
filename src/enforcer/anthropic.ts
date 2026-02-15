import Anthropic from '@anthropic-ai/sdk';
import type { LLMRequest, StructuredResponse } from '../types/index.js';

export class AnthropicEnforcer {
  private client: Anthropic;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('ANTHROPIC_API_KEY is required for Anthropic provider');
    }
    this.client = new Anthropic({ apiKey });
  }

  async enforce(request: LLMRequest): Promise<StructuredResponse> {
    const systemPrompt = [
      request.systemPrompt || '',
      'You must respond with a valid JSON object containing: "answer" (your response), "confidence" (0-100), "evidence" (array of facts), "alternatives" (array of alternative answers).'
    ].filter(Boolean).join('\n\n');

    let userMessage = '';
    if (request.messages && request.messages.length > 0) {
      userMessage = request.messages[request.messages.length - 1].content;
    } else if (request.prompt) {
      userMessage = request.prompt;
    }

    const message = await this.client.messages.create({
      model: request.model || 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ]
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Anthropic API');
    }

    const text = content.text;
    let jsonText = text.trim();
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let structured: StructuredResponse;
    try {
      structured = JSON.parse(jsonText);
    } catch (parseError) {
      structured = {
        answer: text,
        confidence: 50,
        evidence: ['Raw response - could not parse structured format'],
        alternatives: []
      };
    }

    if (!structured.answer) structured.answer = text;
    if (typeof structured.confidence !== 'number') structured.confidence = 50;
    if (!Array.isArray(structured.evidence)) structured.evidence = [];
    if (!Array.isArray(structured.alternatives)) structured.alternatives = [];

    return structured;
  }

  async *enforceStream(request: LLMRequest): AsyncGenerator<string, StructuredResponse, unknown> {
    const systemPrompt = [
      request.systemPrompt || '',
      'You must respond with a valid JSON object containing: "answer" (your response), "confidence" (0-100), "evidence" (array of facts), "alternatives" (array of alternative answers).'
    ].filter(Boolean).join('\n\n');

    let userMessage = '';
    if (request.messages && request.messages.length > 0) {
      userMessage = request.messages[request.messages.length - 1].content;
    } else if (request.prompt) {
      userMessage = request.prompt;
    }

    const stream = await this.client.messages.create({
      model: request.model || 'claude-3-5-sonnet-20241022',
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage
        }
      ],
      stream: true
    });

    let fullContent = '';

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const delta = event.delta.text;
        fullContent += delta;
        yield delta;
      }
    }

    // 最終的な構造化レスポンスを生成
    let jsonText = fullContent.trim();
    const jsonMatch = fullContent.match(/```json\s*([\s\S]*?)\s*```/) || fullContent.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let structured: StructuredResponse;
    try {
      structured = JSON.parse(jsonText);
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
