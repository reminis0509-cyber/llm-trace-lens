/**
 * Tutorial progress persistence (localStorage).
 *
 * v2 schema (2026-04-22): 8 chapters — "おしごと AI の一週間".
 *   月曜朝 / 月曜午後 / 火曜 / 水曜 / 木曜 / 金曜 / 週末 / 来週
 *
 * Backward compatibility: the older v1 schema (4 chapters + chapter3Tasks)
 * is intentionally dropped. loadProgress() returns null for any non-v2 payload
 * so the UI will restart from Ch1. CEO explicitly allowed this (no migration).
 *
 * SSR-safe: no-ops on the server. All reads/writes are wrapped in try/catch
 * so quota-exceeded, disabled storage, or malformed payloads simply yield null.
 */

export type ChapterId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type ChapterState = ChapterId | 'done';

export interface TutorialProgress {
  currentChapter: ChapterState;
  completedChapters: ChapterId[];
  userName?: string;
  startedAt: string;
  completedAt?: string;
  version: 2;
}

const KEY = 'fujitrace_tutorial_progress_v2';

const VALID_CHAPTERS: readonly ChapterState[] = [1, 2, 3, 4, 5, 6, 7, 8, 'done'];

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function isChapterState(v: unknown): v is ChapterState {
  return (
    typeof v === 'number' || typeof v === 'string'
  ) && (VALID_CHAPTERS as readonly unknown[]).includes(v);
}

function isChapterId(v: unknown): v is ChapterId {
  return (
    v === 1 || v === 2 || v === 3 || v === 4 ||
    v === 5 || v === 6 || v === 7 || v === 8
  );
}

function isProgress(v: unknown): v is TutorialProgress {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.version !== 2) return false;
  if (!isChapterState(o.currentChapter)) return false;
  if (!Array.isArray(o.completedChapters)) return false;
  if (!o.completedChapters.every(isChapterId)) return false;
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
    // Also remove the old v1 key if present — avoids confusing resumes
    // from long-time users who previously completed the 4-chapter version.
    window.localStorage.removeItem('fujitrace_tutorial_progress_v1');
  } catch {
    // ignore
  }
}

export function buildInitialProgress(): TutorialProgress {
  return {
    currentChapter: 1,
    completedChapters: [],
    startedAt: new Date().toISOString(),
    version: 2,
  };
}
