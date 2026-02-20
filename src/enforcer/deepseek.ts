import OpenAI from 'openai';
import type { LLMRequest, StructuredResponse } from '../types/index.js';

// DeepSeek models that support response_format: { type: 'json_object' }
const JSON_MODE_SUPPORTED_MODELS = [
  'deepseek-chat',
  'deepseek-coder',
];

function supportsJsonMode(model: string): boolean {
  return JSON_MODE_SUPPORTED_MODELS.some(supported =>
    model.toLowerCase().includes(supported.toLowerCase())
  );
}

export class DeepSeekEnforcer {
  private client: OpenAI;

  constructor(apiKey: string) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('DEEPSEEK_API_KEY is required for DeepSeek provider');
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.deepseek.com/v1'
    });
  }

  async enforce(request: LLMRequest): Promise<StructuredResponse> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      // システムプロンプト
      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt
        });
      }

      // 構造化応答の強制
      messages.push({
        role: 'system',
        content: 'You must respond with a valid JSON object containing: "answer" (your response), "confidence" (0-100), "evidence" (array of facts), "alternatives" (array of alternative answers).'
      });

      // ユーザーメッセージ
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

      // DeepSeek APIコール
      const model = request.model || 'deepseek-chat';

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
        throw new Error('Empty response from DeepSeek API');
      }

      // JSONパース
      let structured: StructuredResponse;
      try {
        structured = JSON.parse(content);
      } catch {
        // フォールバック
        structured = {
          answer: content,
          confidence: 50,
          evidence: ['Raw response - could not parse structured format'],
          alternatives: []
        };
      }

      // 必須フィールドの検証
      if (!structured.answer) {
        structured.answer = content;
      }
      if (typeof structured.confidence !== 'number') {
        structured.confidence = 50;
      }
      if (!Array.isArray(structured.evidence)) {
        structured.evidence = [];
      }
      if (!Array.isArray(structured.alternatives)) {
        structured.alternatives = [];
      }

      return structured;

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication')) {
          throw new Error('Invalid DeepSeek API key. Please check your DEEPSEEK_API_KEY environment variable.');
        }
        throw new Error(`DeepSeek API error: ${error.message}`);
      }
      throw new Error('Unknown error occurred while calling DeepSeek API');
    }
  }

  async *enforceStream(request: LLMRequest): AsyncGenerator<string, StructuredResponse, unknown> {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

      // システムプロンプト
      if (request.systemPrompt) {
        messages.push({
          role: 'system',
          content: request.systemPrompt
        });
      }

      // 構造化応答の強制
      messages.push({
        role: 'system',
        content: 'You must respond with a valid JSON object containing: "answer" (your response), "confidence" (0-100), "evidence" (array of facts), "alternatives" (array of alternative answers).'
      });

      // ユーザーメッセージ
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

      // DeepSeek ストリーミングAPIコール
      const model = request.model || 'deepseek-chat';

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

      // 最終的な構造化レスポンスを生成
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

    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('authentication')) {
          throw new Error('Invalid DeepSeek API key. Please check your DEEPSEEK_API_KEY environment variable.');
        }
        throw new Error(`DeepSeek streaming error: ${error.message}`);
      }
      throw new Error('Unknown error occurred during DeepSeek streaming');
    }
  }
}
