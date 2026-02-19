import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import type { LLMRequest, StructuredResponse } from '../types/index.js';

export class GeminiEnforcer {
  private client: GoogleGenerativeAI;
  private model: GenerativeModel;

  constructor(apiKey: string, modelName: string = 'gemini-pro') {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('GOOGLE_API_KEY is required for Gemini provider');
    }

    try {
      this.client = new GoogleGenerativeAI(apiKey);
      this.model = this.client.getGenerativeModel({ model: modelName });
    } catch (error) {
      throw new Error(`Failed to initialize Gemini client: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async enforce(request: LLMRequest): Promise<StructuredResponse> {
    try {
      // プロンプトの構築
      const systemPrompt = request.systemPrompt || '';
      const userMessage = request.messages?.[request.messages.length - 1]?.content || request.prompt || '';

      const fullPrompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nYou must respond with a valid JSON object containing:\n- "answer": your response text\n- "confidence": number 0-100\n- "evidence": array of supporting facts\n- "alternatives": array of alternative answers`;

      // Gemini APIリクエスト
      const result = await this.model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      if (!text) {
        throw new Error('Empty response from Gemini API');
      }

      // JSON抽出（マークダウンコードブロックを考慮）
      let jsonText = text.trim();
      const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1].trim();
      }

      // JSONパース
      let structured: StructuredResponse;
      try {
        structured = JSON.parse(jsonText);
      } catch (parseError) {
        // パース失敗時はフォールバック
        structured = {
          answer: text,
          confidence: 50,
          evidence: ['Raw response from Gemini - could not parse structured format'],
          alternatives: []
        };
      }

      // 必須フィールドの検証
      if (!structured.answer) {
        structured.answer = text;
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
        if (error.message.includes('API key')) {
          throw new Error('Invalid Google API key. Please check your GOOGLE_API_KEY environment variable.');
        }
        if (error.message.includes('quota') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('429')) {
          throw new Error('Gemini API quota exceeded. Please wait or upgrade your plan.');
        }
        if (error.message.includes('model')) {
          throw new Error(`Invalid Gemini model. Please check the model name.`);
        }
        throw new Error(`Gemini API error: ${error.message}`);
      }
      throw new Error('Unknown error occurred while calling Gemini API');
    }
  }

  async *enforceStream(request: LLMRequest): AsyncGenerator<string, StructuredResponse, unknown> {
    try {
      // プロンプトの構築
      const systemPrompt = request.systemPrompt || '';
      const userMessage = request.messages?.[request.messages.length - 1]?.content || request.prompt || '';

      const fullPrompt = `${systemPrompt}\n\nUser: ${userMessage}\n\nYou must respond with a valid JSON object containing:\n- "answer": your response text\n- "confidence": number 0-100\n- "evidence": array of supporting facts\n- "alternatives": array of alternative answers`;

      // Gemini ストリーミングAPIリクエスト
      const result = await this.model.generateContentStream(fullPrompt);

      let fullContent = '';

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        if (chunkText) {
          fullContent += chunkText;
          yield chunkText;
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
          evidence: ['Raw response from Gemini - could not parse structured format'],
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
        if (error.message.includes('API key')) {
          throw new Error('Invalid Google API key. Please check your GOOGLE_API_KEY environment variable.');
        }
        throw new Error(`Gemini streaming error: ${error.message}`);
      }
      throw new Error('Unknown error occurred during Gemini streaming');
    }
  }
}
