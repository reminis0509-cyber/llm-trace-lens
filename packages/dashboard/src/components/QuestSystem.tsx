import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Check, Clock, Copy, ChevronRight, Clipboard } from 'lucide-react';
import {
  CATEGORY_META,
  QUESTS,
  difficultyLabel,
  getCategoryMeta,
  getQuestsByCategory,
  type Quest,
  type QuestCategory,
} from '../lib/quest-questions';
import { isInLiff, closeLiffWindow } from '../lib/liff-detect';

// ---------------------------------------------------------------------------
// Types / constants
// ---------------------------------------------------------------------------

interface QuestProgress {
  completedQuests: string[];
  currentSteps: Record<string, boolean[]>;
}

// v2 key — old v1 payloads are intentionally discarded (schema changed, no
// meaningful migration path, CEO approved re-start).
const QUEST_STORAGE_KEY = 'fujitrace_quest_progress_v2';

// ---------------------------------------------------------------------------
// Progress I/O
// ---------------------------------------------------------------------------

function loadProgress(): QuestProgress {
  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuestProgress;
      return {
        completedQuests: Array.isArray(parsed.completedQuests) ? parsed.completedQuests : [],
        currentSteps:
          parsed.currentSteps && typeof parsed.currentSteps === 'object' ? parsed.currentSteps : {},
      };
    }
  } catch {
    // corrupted data — reset
  }
  return { completedQuests: [], currentSteps: {} };
}

function saveProgress(progress: QuestProgress): void {
  try {
    localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // quota-exceeded / disabled storage — silently ignore
  }
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuestSystemProps {
  onSwitchToClerk: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuestSystem({ onSwitchToClerk }: QuestSystemProps) {
  const [progress, setProgress] = useState<QuestProgress>(loadProgress);
  const [selectedQuestId, setSelectedQuestId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const inLiff = isInLiff();

  const selectedQuest = useMemo(
    () => (selectedQuestId ? QUESTS.find((q) => q.id === selectedQuestId) ?? null : null),
    [selectedQuestId],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Step toggling
  const toggleStep = useCallback((questId: string, stepIndex: number) => {
    setProgress((prev) => {
      const quest = QUESTS.find((q) => q.id === questId);
      if (!quest) return prev;

      const steps = prev.currentSteps[questId]
        ? [...prev.currentSteps[questId]]
        : new Array<boolean>(quest.steps.length).fill(false);
      steps[stepIndex] = !steps[stepIndex];

      const next: QuestProgress = {
        ...prev,
        currentSteps: { ...prev.currentSteps, [questId]: steps },
      };
      saveProgress(next);
      return next;
    });
  }, []);

  // Complete quest
  const completeQuest = useCallback(
    (questId: string) => {
      setProgress((prev) => {
        if (prev.completedQuests.includes(questId)) return prev;
        const next: QuestProgress = {
          ...prev,
          completedQuests: [...prev.completedQuests, questId],
        };
        saveProgress(next);
        return next;
      });
      setSelectedQuestId(null);
      showToast('クエスト完了');
    },
    [showToast],
  );

  // Copy hint and switch tab
  const handleCopyAndSwitch = useCallback(
    async (hint: string) => {
      const ok = await copyToClipboard(hint);
      if (ok) {
        showToast('ヒントをコピーしました。おしごと AIに貼り付けて送信してください。');
      }
      onSwitchToClerk();
    },
    [onSwitchToClerk, showToast],
  );

  // Copy hint only (for multi-line hints like memory settings)
  const handleCopyOnly = useCallback(
    async (hint: string) => {
      const ok = await copyToClipboard(hint);
      if (ok) {
        showToast('コピーしました');
      }
    },
    [showToast],
  );

  // -----------------------------------------------------------------------
  // Detail view
  // -----------------------------------------------------------------------
  if (selectedQuest) {
    const stepStates =
      progress.currentSteps[selectedQuest.id] ??
      new Array<boolean>(selectedQuest.steps.length).fill(false);
    const allStepsCompleted =
      stepStates.length === selectedQuest.steps.length && stepStates.every(Boolean);
    const isAlreadyDone = progress.completedQuests.includes(selectedQuest.id);
    const categoryMeta = getCategoryMeta(selectedQuest.category);

    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-0 py-8">
        {toast && <Toast message={toast} />}

        {inLiff && <LiffReturnButton />}

        <button
          type="button"
          onClick={() => setSelectedQuestId(null)}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors duration-120"
          aria-label="クエスト一覧に戻る"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span>戻る</span>
        </button>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-text-muted">
              Quest {selectedQuest.number}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${categoryMeta.badgeClass}`}
            >
              {categoryMeta.label}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
              {difficultyLabel(selectedQuest.difficulty)}
            </span>
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Clock className="w-3 h-3" strokeWidth={1.5} />
              {selectedQuest.estimatedTime}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">{selectedQuest.title}</h2>
          <p className="text-sm text-text-secondary">{selectedQuest.objective}</p>
        </div>

        {/* Expected answer preview */}
        <div className="mb-6 rounded-card border border-border bg-base-elevated px-4 py-3">
          <p className="text-xs font-semibold text-text-primary mb-1">おしごと AIが返す内容（目安）</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            {selectedQuest.sampleAnswer}
          </p>
        </div>

        {/* Steps */}
        <div className="rounded-card border border-border bg-base-surface">
          <div className="px-5 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">ステップ</h3>
          </div>
          <div className="divide-y divide-border">
            {selectedQuest.steps.map((step, i) => {
              const checked = stepStates[i] ?? false;
              return (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => toggleStep(selectedQuest.id, i)}
                      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border transition-colors duration-120 flex items-center justify-center ${
                        checked
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-border hover:border-text-muted'
                      } cursor-pointer`}
                      aria-label={`Step ${i + 1}: ${step.instruction}`}
                      aria-checked={checked}
                      role="checkbox"
                    >
                      {checked && <Check className="w-3 h-3" strokeWidth={2.5} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          checked ? 'text-text-muted line-through' : 'text-text-primary'
                        }`}
                      >
                        Step {i + 1}: {step.instruction}
                      </p>
                      {step.hint && (
                        <div className="mt-2 rounded bg-base-elevated px-3 py-2 text-xs text-text-secondary font-mono whitespace-pre-wrap break-all">
                          {step.hint}
                        </div>
                      )}
                      {step.hint && step.checkType === 'send_message' && (
                        <button
                          type="button"
                          onClick={() => handleCopyAndSwitch(step.hint!)}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent hover:text-accent/80 border border-accent/30 hover:border-accent/50 rounded-card transition-colors duration-120"
                          aria-label="ヒントをコピーしておしごと AIに移動"
                        >
                          <Copy className="w-3 h-3" strokeWidth={1.5} />
                          コピーして おしごと AIに送る
                          <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
                        </button>
                      )}
                      {step.hint && step.checkType !== 'send_message' && (
                        <button
                          type="button"
                          onClick={() => handleCopyOnly(step.hint!)}
                          className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary hover:text-text-primary border border-border hover:border-text-muted rounded-card transition-colors duration-120"
                          aria-label="テキストをコピー"
                        >
                          <Clipboard className="w-3 h-3" strokeWidth={1.5} />
                          コピー
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Complete button */}
        {!isAlreadyDone && (
          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => completeQuest(selectedQuest.id)}
              disabled={!allStepsCompleted}
              className={`inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-card transition-colors duration-120 ${
                allStepsCompleted
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-base-elevated text-text-muted cursor-not-allowed'
              }`}
              aria-label="クエストを完了する"
            >
              <Check className="w-4 h-4" strokeWidth={1.5} />
              クエストを完了する
            </button>
            {!allStepsCompleted && (
              <p className="mt-2 text-xs text-text-muted">
                すべてのステップを完了するとボタンが有効になります
              </p>
            )}
          </div>
        )}
        {isAlreadyDone && (
          <div className="mt-6 text-center text-xs text-emerald-700">
            このクエストは完了済みです
          </div>
        )}
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // List view
  // -----------------------------------------------------------------------
  const totalCompleted = progress.completedQuests.filter((id) =>
    QUESTS.some((q) => q.id === id),
  ).length;
  const totalAvailable = QUESTS.length;

  const allCompleted = totalCompleted === totalAvailable && totalAvailable > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-0 py-8">
      {toast && <Toast message={toast} />}

      {inLiff && <LiffReturnButton />}

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary">応用クエスト</h2>
        <p className="text-sm text-text-secondary mt-1">
          チュートリアルの次のステップ。本物の AI が動きます。
        </p>
        <p className="text-xs text-text-muted mt-2">
          {totalCompleted} / {totalAvailable} 完了・8 カテゴリ・23 問
        </p>
      </div>

      {inLiff && allCompleted && (
        <div className="mb-8 rounded-card border border-emerald-200 bg-emerald-50/60 px-5 py-4 text-center">
          <p className="text-sm font-semibold text-emerald-800">
            すべてのクエストを完了しました
          </p>
          <p className="mt-1 text-xs text-emerald-700">
            下のボタンから LINE に戻れます。
          </p>
          <button
            type="button"
            onClick={closeLiffWindow}
            className="mt-3 inline-flex items-center gap-2 rounded-card bg-[#1d3557] px-5 py-2 text-sm font-semibold text-white hover:bg-[#16263f]"
            aria-label="LINEに戻る"
          >
            LINE に戻る
          </button>
        </div>
      )}

      {/* Category sections */}
      {CATEGORY_META.map((cat) => (
        <CategorySection
          key={cat.id}
          category={cat.id}
          progress={progress}
          onSelect={setSelectedQuestId}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category section
// ---------------------------------------------------------------------------

interface CategorySectionProps {
  category: QuestCategory;
  progress: QuestProgress;
  onSelect: (id: string) => void;
}

function CategorySection({ category, progress, onSelect }: CategorySectionProps) {
  const meta = getCategoryMeta(category);
  const quests = getQuestsByCategory(category);
  const completedCount = quests.filter((q) => progress.completedQuests.includes(q.id)).length;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <h3 className={`text-sm font-semibold ${meta.accentClass}`}>{meta.label}</h3>
        <span
          className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${meta.badgeClass}`}
        >
          {completedCount} / {quests.length}
        </span>
      </div>
      <p className="text-xs text-text-muted mb-3">{meta.summary}</p>
      <div className="space-y-3">
        {quests.map((quest) => (
          <QuestCard
            key={quest.id}
            quest={quest}
            progress={progress}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestCard
// ---------------------------------------------------------------------------

interface QuestCardProps {
  quest: Quest;
  progress: QuestProgress;
  onSelect: (id: string) => void;
}

function QuestCard({ quest, progress, onSelect }: QuestCardProps) {
  const isCompleted = progress.completedQuests.includes(quest.id);
  const meta = getCategoryMeta(quest.category);

  return (
    <button
      type="button"
      onClick={() => onSelect(quest.id)}
      className={`w-full text-left rounded-card border transition-colors duration-120 cursor-pointer ${
        isCompleted
          ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300'
          : 'border-border bg-base-surface hover:border-accent/40'
      }`}
      aria-label={`Quest ${quest.number}: ${quest.title}`}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Status / number badge */}
        <div className="flex-shrink-0">
          {isCompleted ? (
            <div
              className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center"
              aria-label="完了"
            >
              <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
          ) : (
            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
              <span className="text-xs font-semibold text-white">{quest.number}</span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-medium text-text-primary">{quest.title}</p>
            <span
              className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold ${meta.badgeClass}`}
            >
              {meta.label}
            </span>
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-700">
              {difficultyLabel(quest.difficulty)}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{quest.description}</p>
        </div>

        {/* Time estimate */}
        <div className="flex-shrink-0 flex items-center gap-1 text-xs text-text-muted">
          <Clock className="w-3 h-3" strokeWidth={1.5} />
          {quest.estimatedTime}
        </div>

        <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" strokeWidth={1.5} />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

interface ToastProps {
  message: string;
}

function Toast({ message }: ToastProps) {
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-900 text-white text-sm rounded-card shadow-lg"
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LIFF return button — always-visible "LINEに戻る" CTA shown only when the
// QuestSystem is rendered inside a LIFF session. In a regular browser this
// component is never mounted.
// ---------------------------------------------------------------------------

function LiffReturnButton() {
  return (
    <div className="mb-4 flex justify-end">
      <button
        type="button"
        onClick={closeLiffWindow}
        className="inline-flex items-center gap-1.5 rounded-card bg-[#1d3557] px-4 py-2 text-xs font-semibold text-white hover:bg-[#16263f]"
        aria-label="LINEに戻る"
      >
        LINE に戻る
      </button>
    </div>
  );
}
