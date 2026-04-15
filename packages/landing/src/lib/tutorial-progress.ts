/**
 * Tutorial progress persistence (localStorage).
 * SSR-safe: no-ops on the server. All reads/writes are wrapped in try/catch
 * so quota-exceeded, disabled storage, or malformed payloads simply yield null.
 */

export type ChapterId = 1 | 2 | 3 | 4;
export type ChapterState = ChapterId | 'done';
export type PracticeTaskId = 'purchase_order' | 'cover_letter' | 'delivery_note';

export interface TutorialProgress {
  currentChapter: ChapterState;
  completedChapters: ChapterId[];
  chapter3Tasks: PracticeTaskId[];
  userName?: string;
  startedAt: string;
  completedAt?: string;
  version: 1;
}

const KEY = 'fujitrace_tutorial_progress_v1';

const VALID_CHAPTERS: readonly ChapterState[] = [1, 2, 3, 4, 'done'];
const VALID_TASKS: readonly PracticeTaskId[] = [
  'purchase_order',
  'cover_letter',
  'delivery_note',
];

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isChapterState(v: unknown): v is ChapterState {
  return (
    typeof v === 'number' || typeof v === 'string'
  ) && (VALID_CHAPTERS as readonly unknown[]).includes(v);
}

function isChapterId(v: unknown): v is ChapterId {
  return v === 1 || v === 2 || v === 3 || v === 4;
}

function isPracticeTaskId(v: unknown): v is PracticeTaskId {
  return typeof v === 'string' && (VALID_TASKS as readonly string[]).includes(v);
}

function isProgress(v: unknown): v is TutorialProgress {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.version !== 1) return false;
  if (!isChapterState(o.currentChapter)) return false;
  if (!Array.isArray(o.completedChapters)) return false;
  if (!o.completedChapters.every(isChapterId)) return false;
  if (!Array.isArray(o.chapter3Tasks)) return false;
  if (!o.chapter3Tasks.every(isPracticeTaskId)) return false;
  if (typeof o.startedAt !== 'string') return false;
  if (o.userName !== undefined && typeof o.userName !== 'string') return false;
  if (o.completedAt !== undefined && typeof o.completedAt !== 'string') return false;
  return true;
}

export function loadProgress(): TutorialProgress | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isProgress(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveProgress(progress: TutorialProgress): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // quota exceeded / storage disabled — silently ignore
  }
}

export function resetProgress(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function buildInitialProgress(): TutorialProgress {
  return {
    currentChapter: 1,
    completedChapters: [],
    chapter3Tasks: [],
    startedAt: new Date().toISOString(),
    version: 1,
  };
}
