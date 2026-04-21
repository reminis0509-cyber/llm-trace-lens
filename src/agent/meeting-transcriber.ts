/**
 * agent/meeting-transcriber.ts — AI 社員 v2.1 Voice-to-minutes tool.
 *
 * Given a base64-encoded audio file (mp3 / wav / m4a) the transcriber:
 *   1. Calls OpenAI Whisper (`openai.audio.transcriptions.create`) to produce
 *      a raw Japanese (default) transcript.
 *   2. Passes the transcript to an LLM to extract a Japanese business-meeting
 *      minutes structure (参加者 / 議題 / 決定事項 / ToDo / 次回アクション).
 *
 * Whisper is pluggable via `createTranscriber`: tests inject a mock so the
 * suite never needs a real Whisper key. The LLM call uses the same
 * `callLlmViaProxy` helper used by every other tool in the codebase.
 */
import OpenAI from 'openai';
import { toFile } from 'openai/uploads';
import type { FastifyInstance } from 'fastify';
import { callLlmViaProxy, parseLlmJson, type LlmMessage } from '../routes/tools/_shared.js';

export type AudioFormat = 'mp3' | 'wav' | 'm4a';

export interface MeetingTranscriberInput {
  audioBase64: string;
  audioFormat: AudioFormat;
  language?: string; // ISO-639-1, default 'ja'
}

export interface MeetingMinutes {
  日時: string;
  参加者: string[];
  議題: string[];
  決定事項: string[];
  todo: Array<{ 担当: string; 内容: string; 期限?: string }>;
  次回: string;
}

export interface MeetingTranscriberOutput {
  transcript: string;
  minutes: MeetingMinutes;
}

/**
 * Thin interface over Whisper so the tests can inject a deterministic mock.
 * `transcribe` takes a Buffer + format and returns plain text.
 */
export interface Transcriber {
  transcribe(audio: Buffer, format: AudioFormat, language: string): Promise<string>;
}

/** Default Transcriber implementation backed by OpenAI Whisper. */
export function createOpenAiTranscriber(): Transcriber {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  const client = new OpenAI({ apiKey });
  return {
    async transcribe(audio, format, language) {
      const file = await toFile(audio, `audio.${format}`, {
        type: `audio/${format === 'm4a' ? 'mp4' : format}`,
      });
      const res = await client.audio.transcriptions.create({
        file,
        model: 'whisper-1',
        language,
        response_format: 'text',
      });
      // whisper returns string when response_format='text'
      return typeof res === 'string' ? res : (res as { text?: string }).text ?? '';
    },
  };
}

/**
 * Ask the LLM to structure a raw transcript into Japanese business minutes.
 * The LLM is instructed to emit JSON only; we parse with `parseLlmJson` which
 * tolerates stray prose / code fences.
 */
export async function transcriptToMinutes(
  fastify: FastifyInstance,
  transcript: string,
  now: Date,
): Promise<MeetingMinutes> {
  const isoNow = now.toISOString().replace('T', ' ').slice(0, 16);
  const messages: LlmMessage[] = [
    {
      role: 'system',
      content: [
        'あなたは日本企業の議事録作成アシスタントです。',
        '入力された会議の文字起こしから、日本のビジネス慣行に沿った議事録を JSON で出力してください。',
        '必ず以下のスキーマに厳密に従い、JSON 1 オブジェクトのみ返すこと:',
        '{',
        '  "日時": "<YYYY-MM-DD HH:MM>",',
        '  "参加者": ["<氏名 or 役職>", ...],',
        '  "議題": ["<議題1>", ...],',
        '  "決定事項": ["<決定1>", ...],',
        '  "todo": [{"担当":"<氏名>","内容":"<タスク>","期限":"<任意>"}, ...],',
        '  "次回": "<次回アクション or 日程>"',
        '}',
        '判別不能な項目は空配列 / 空文字列にする。絵文字、Markdown、コードフェンスは禁止。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `現在時刻: ${isoNow}`,
        '',
        '以下は会議の文字起こしです:',
        '---',
        transcript.slice(0, 12000),
        '---',
      ].join('\n'),
    },
  ];

  const { content } = await callLlmViaProxy(fastify, messages, {
    model: 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 1500,
  });

  type RawMinutes = {
    日時?: string;
    参加者?: string[];
    議題?: string[];
    決定事項?: string[];
    todo?: Array<{ 担当?: string; 内容?: string; 期限?: string }>;
    次回?: string;
  };

  let raw: RawMinutes;
  try {
    raw = parseLlmJson<RawMinutes>(content);
  } catch {
    raw = {};
  }

  return {
    日時: (raw.日時 ?? isoNow).toString(),
    参加者: Array.isArray(raw.参加者) ? raw.参加者.map((v) => String(v)) : [],
    議題: Array.isArray(raw.議題) ? raw.議題.map((v) => String(v)) : [],
    決定事項: Array.isArray(raw.決定事項) ? raw.決定事項.map((v) => String(v)) : [],
    todo: Array.isArray(raw.todo)
      ? raw.todo
          .filter((t): t is { 担当?: string; 内容?: string; 期限?: string } => t !== null && typeof t === 'object')
          .map((t) => ({
            担当: String(t.担当 ?? ''),
            内容: String(t.内容 ?? ''),
            期限: t.期限 ? String(t.期限) : undefined,
          }))
      : [],
    次回: String(raw.次回 ?? ''),
  };
}

/** Main entry: Whisper transcribe → LLM structure → return payload. */
export async function transcribeMeeting(
  fastify: FastifyInstance,
  input: MeetingTranscriberInput,
  deps?: { transcriber?: Transcriber; now?: Date },
): Promise<MeetingTranscriberOutput> {
  if (!input.audioBase64 || input.audioBase64.length === 0) {
    throw new Error('audioBase64 is required');
  }
  const audio = Buffer.from(input.audioBase64, 'base64');
  if (audio.length === 0) {
    throw new Error('empty audio buffer');
  }
  const language = input.language ?? 'ja';
  const transcriber = deps?.transcriber ?? createOpenAiTranscriber();
  const transcript = await transcriber.transcribe(audio, input.audioFormat, language);
  const minutes = await transcriptToMinutes(fastify, transcript, deps?.now ?? new Date());
  return { transcript, minutes };
}
