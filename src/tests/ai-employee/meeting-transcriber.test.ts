/**
 * meeting-transcriber.test.ts — AI 社員 v2.1 voice-to-minutes unit tests.
 *
 * Whisper and the LLM are both mocked so the test is deterministic and
 * network-free. We assert that:
 *   1. The mock Whisper output is passed through unchanged as `transcript`.
 *   2. The mock LLM JSON is structured into MeetingMinutes with every
 *      expected key, including optional `期限` fields on todos.
 *   3. Malformed LLM JSON still yields a valid (empty-field) minutes shape
 *      — the tool must never crash on a bad LLM response.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FastifyInstance } from 'fastify';

// Hoisted mock wiring: every test flips `mockLlmContent` to steer the
// proxy LLM response. The vi.mock factory closes over the module-level
// variable, which is safe because vitest re-evaluates the module per file.
const llmState: { content: string } = { content: '{}' };

vi.mock('../../routes/tools/_shared.js', async () => {
  const actual = await vi.importActual<typeof import('../../routes/tools/_shared.js')>(
    '../../routes/tools/_shared.js',
  );
  return {
    ...actual,
    callLlmViaProxy: vi.fn(async () => ({
      content: llmState.content,
      traceId: 'test-trace',
      usage: null,
    })),
  };
});

const { transcribeMeeting, transcriptToMinutes } = await import(
  '../../agent/meeting-transcriber.js'
);

const fakeFastify = {} as FastifyInstance;

describe('meeting-transcriber: transcriptToMinutes', () => {
  beforeEach(() => {
    llmState.content = '{}';
  });

  it('structures a well-formed LLM JSON into MeetingMinutes', async () => {
    llmState.content = JSON.stringify({
      日時: '2026-04-21 10:00',
      参加者: ['田中', '佐藤'],
      議題: ['Q2ロードマップ'],
      決定事項: ['AI社員v2.1を5月に出す'],
      todo: [
        { 担当: '田中', 内容: 'スライド草案', 期限: '2026-04-28' },
        { 担当: '佐藤', 内容: 'PR準備' },
      ],
      次回: '2026-04-28 10:00',
    });
    const minutes = await transcriptToMinutes(fakeFastify, 'transcript text', new Date());
    expect(minutes.日時).toBe('2026-04-21 10:00');
    expect(minutes.参加者).toEqual(['田中', '佐藤']);
    expect(minutes.決定事項).toHaveLength(1);
    expect(minutes.todo).toHaveLength(2);
    expect(minutes.todo[0].期限).toBe('2026-04-28');
    expect(minutes.todo[1].期限).toBeUndefined();
    expect(minutes.次回).toBe('2026-04-28 10:00');
  });

  it('returns empty arrays on malformed LLM output (never crashes)', async () => {
    llmState.content = 'totally not json';
    const minutes = await transcriptToMinutes(fakeFastify, 'x', new Date('2026-01-01T00:00:00Z'));
    expect(minutes.参加者).toEqual([]);
    expect(minutes.議題).toEqual([]);
    expect(minutes.決定事項).toEqual([]);
    expect(minutes.todo).toEqual([]);
    expect(minutes.次回).toBe('');
    // Fallback uses the supplied `now` ISO prefix.
    expect(minutes.日時).toContain('2026-01-01');
  });
});

describe('meeting-transcriber: transcribeMeeting end-to-end (Whisper mocked)', () => {
  beforeEach(() => {
    llmState.content = JSON.stringify({
      日時: '2026-04-21 11:00',
      参加者: ['山田'],
      議題: ['予算'],
      決定事項: ['承認'],
      todo: [],
      次回: '来週',
    });
  });

  it('passes the mock transcript through and fills minutes from the LLM', async () => {
    const fakeAudio = Buffer.from('dummy-audio-bytes').toString('base64');
    const result = await transcribeMeeting(
      fakeFastify,
      { audioBase64: fakeAudio, audioFormat: 'mp3' },
      {
        transcriber: {
          async transcribe(buf, fmt) {
            expect(buf.toString()).toBe('dummy-audio-bytes');
            expect(fmt).toBe('mp3');
            return '山田です。今日は予算の話をします。承認しました。';
          },
        },
        now: new Date('2026-04-21T11:00:00Z'),
      },
    );
    expect(result.transcript).toContain('山田です');
    expect(result.minutes.参加者).toEqual(['山田']);
    expect(result.minutes.決定事項).toEqual(['承認']);
  });

  it('rejects an empty audio payload', async () => {
    await expect(
      transcribeMeeting(fakeFastify, { audioBase64: '', audioFormat: 'mp3' }),
    ).rejects.toThrow();
  });
});
