import { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Check, Lock, Clock, Copy, ChevronRight, Clipboard } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestStep {
  instruction: string;
  hint?: string;
  checkType: 'send_message' | 'receive_response' | 'pdf_generated';
}

interface Quest {
  id: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  number: number;
  title: string;
  description: string;
  objective: string;
  hint: string;
  estimatedTime: string;
  steps: QuestStep[];
}

interface QuestProgress {
  completedQuests: string[];
  currentSteps: Record<string, boolean[]>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const QUEST_STORAGE_KEY = 'fujitrace_quest_progress';

const BEGINNER_QUESTS: Quest[] = [
  {
    id: 'beginner-1',
    level: 'beginner',
    number: 1,
    title: '見積書を30秒で作る',
    description: '必要な情報を一括で送り、見積書をPDFで出力するまでを体験します。',
    objective: 'フジに必要な情報をまとめて送り、見積書を完成させてPDFで出力する',
    hint: '見積書を作成。宛先: 株式会社サンプル 山田様、品目: Webデザイン 1式 200,000円、納期: 来月末',
    estimatedTime: '2分',
    steps: [
      {
        instruction: 'フジに以下の情報を一括で送ってみましょう: 宛先・品目・金額・納期',
        hint: '見積書を作成。宛先: 株式会社サンプル 山田様、品目: Webデザイン 1式 200,000円、納期: 来月末',
        checkType: 'send_message',
      },
      {
        instruction: '承認ボタンを押して見積書を完成させましょう',
        checkType: 'receive_response',
      },
      {
        instruction: 'PDFで出力ボタンを押してダウンロードしてみましょう',
        checkType: 'pdf_generated',
      },
    ],
  },
  {
    id: 'beginner-2',
    level: 'beginner',
    number: 2,
    title: '請求書を正確に作る',
    description: '振込先やインボイス番号を含む請求書を作成します。',
    objective: '請求書に必要なすべての情報（振込先・インボイス番号含む）を送り、PDFで出力する',
    hint: '請求書を作成。宛先: 株式会社テスト 佐藤様、品目: コンサルティング 月額50,000円×3ヶ月、支払期限: 来月末、振込先: みずほ銀行 渋谷支店 普通 1234567',
    estimatedTime: '3分',
    steps: [
      {
        instruction: '請求書に必要な情報（振込先・インボイス番号含む）を送りましょう',
        hint: '請求書を作成。宛先: 株式会社テスト 佐藤様、品目: コンサルティング 月額50,000円×3ヶ月、支払期限: 来月末、振込先: みずほ銀行 渋谷支店 普通 1234567',
        checkType: 'send_message',
      },
      {
        instruction: '内容を確認して承認しましょう',
        checkType: 'receive_response',
      },
      {
        instruction: 'PDFで出力してファイル名を確認しましょう',
        checkType: 'pdf_generated',
      },
    ],
  },
  {
    id: 'beginner-3',
    level: 'beginner',
    number: 3,
    title: '書類3点セットを一気に作る',
    description: '同じ会話で見積書・発注書・送付状を連続作成します。',
    objective: '1つの会話の中で見積書、発注書、送付状の3点を連続して作成する',
    hint: '見積書を作成。株式会社ABC 田中様、品目: ロゴデザイン 1式 150,000円',
    estimatedTime: '5分',
    steps: [
      {
        instruction: 'まず見積書を作成しましょう',
        hint: '見積書を作成。株式会社ABC 田中様、品目: ロゴデザイン 1式 150,000円',
        checkType: 'send_message',
      },
      {
        instruction: '同じ会話で発注書も作成しましょう',
        hint: 'この案件の発注書も作って',
        checkType: 'send_message',
      },
      {
        instruction: '最後に送付状を作成しましょう',
        hint: '見積書と発注書を同封する送付状を作って',
        checkType: 'send_message',
      },
    ],
  },
  {
    id: 'beginner-4',
    level: 'beginner',
    number: 4,
    title: 'AIに調査レポートを書かせる',
    description: 'フジに調査を依頼し、レポートをPDFで出力します。',
    objective: 'フジにリサーチを依頼し、出典付きのレポートをPDFで出力する',
    hint: '日本の中小企業のDX推進状況について500字程度でまとめてください',
    estimatedTime: '3分',
    steps: [
      {
        instruction: 'フジに業界の調査を依頼しましょう',
        hint: '日本の中小企業のDX推進状況について500字程度でまとめてください',
        checkType: 'send_message',
      },
      {
        instruction: '出典が記載されているか確認しましょう',
        checkType: 'receive_response',
      },
      {
        instruction: 'PDFで出力ボタンでレポートをダウンロードしましょう',
        checkType: 'pdf_generated',
      },
    ],
  },
  {
    id: 'beginner-5',
    level: 'beginner',
    number: 5,
    title: 'メモリを使いこなす',
    description: 'デフォルト設定をメモリに保存し、書類作成に反映させます。',
    objective: 'メモリにデフォルト設定を保存し、新しい会話で設定が反映されることを確認する',
    hint: '',
    estimatedTime: '3分',
    steps: [
      {
        instruction: '画面右上のメモリボタンを開きましょう',
        checkType: 'send_message',
      },
      {
        instruction: 'デフォルト設定を保存しましょう',
        hint: '・消費税は軽減税率8%で計算\n・支払条件はデフォルトで月末締め翌月末払い\n・敬称は御中を使用',
        checkType: 'send_message',
      },
      {
        instruction: '新しい会話で見積書を作成し、メモリの設定が反映されているか確認しましょう',
        checkType: 'receive_response',
      },
    ],
  },
];

const INTERMEDIATE_QUESTS: Quest[] = [
  {
    id: 'intermediate-1',
    level: 'intermediate',
    number: 6,
    title: '見積書の妥当性をチェックさせる',
    description: '作成した見積書をフジに検証させ、金額ミスや記載漏れを指摘してもらいます',
    objective: 'AIをレビュアーとして活用する方法を学ぶ',
    hint: '見積書を作成。宛先: 株式会社テスト 山田様、品目: システム開発 1式 800,000円、納期: 来月末',
    estimatedTime: '3分',
    steps: [
      {
        instruction: 'まず見積書を作成しましょう（意図的に支払条件を空欄にしてみてください）',
        hint: '見積書を作成。宛先: 株式会社テスト 山田様、品目: システム開発 1式 800,000円、納期: 来月末',
        checkType: 'send_message',
      },
      {
        instruction: '作成した見積書の内容をフジにチェックさせましょう',
        hint: 'この見積書に問題がないかチェックしてください。支払条件が抜けていませんか？',
        checkType: 'send_message',
      },
      {
        instruction: 'フジの指摘を確認し、修正指示を出してみましょう',
        hint: '支払条件を「納品後30日以内」に修正して再作成してください',
        checkType: 'send_message',
      },
    ],
  },
  {
    id: 'intermediate-2',
    level: 'intermediate',
    number: 7,
    title: '競合調査レポートを作成する',
    description: 'フジに業界調査を依頼し、出典付きのレポートをPDFで出力します',
    objective: 'AIをリサーチャーとして活用する方法を学ぶ',
    hint: '日本のSaaS業界の主要5社について、売上規模・主力製品・特徴を比較分析してレポートを作成してください',
    estimatedTime: '5分',
    steps: [
      {
        instruction: 'フジに業界の調査レポートを依頼しましょう',
        hint: '日本のSaaS業界の主要5社について、売上規模・主力製品・特徴を比較分析してレポートを作成してください',
        checkType: 'send_message',
      },
      {
        instruction: 'レポートに出典が記載されているか確認しましょう',
        checkType: 'receive_response',
      },
      {
        instruction: 'PDFで出力ボタンでレポートをダウンロードしましょう',
        checkType: 'pdf_generated',
      },
    ],
  },
  {
    id: 'intermediate-3',
    level: 'intermediate',
    number: 8,
    title: '月次報告書のたたき台を作る',
    description: '売上や経費のデータをフジに渡して、月次報告書を生成させます',
    objective: 'AIにデータを渡して文書化するスキルを身につける',
    hint: '4月の月次報告書を作成してください。売上: 350万円（前月比+15%）、経費: 180万円（人件費120万、広告費30万、その他30万）、新規顧客: 5社、解約: 1社',
    estimatedTime: '5分',
    steps: [
      {
        instruction: '月次の数字をフジに伝えて報告書を依頼しましょう',
        hint: '4月の月次報告書を作成してください。売上: 350万円（前月比+15%）、経費: 180万円（人件費120万、広告費30万、その他30万）、新規顧客: 5社、解約: 1社',
        checkType: 'send_message',
      },
      {
        instruction: '報告書の内容を確認し、分析コメントが含まれているか確認しましょう',
        checkType: 'receive_response',
      },
      {
        instruction: 'PDFで出力してダウンロードしましょう',
        checkType: 'pdf_generated',
      },
    ],
  },
  {
    id: 'intermediate-4',
    level: 'intermediate',
    number: 9,
    title: 'メール文面を3パターン作らせる',
    description: '同じ内容のメールを丁寧・標準・カジュアルの3パターンで作成させます',
    objective: 'AIに条件分岐の出力をさせるスキルを身につける',
    hint: '新規取引先への挨拶メールを3パターン作成してください。パターン1: 非常に丁寧（大企業向け）、パターン2: 標準的なビジネス、パターン3: カジュアル（スタートアップ向け）。内容は自己紹介と今後の協業への期待です。',
    estimatedTime: '3分',
    steps: [
      {
        instruction: 'フジに3パターンのメールを一度に依頼しましょう',
        hint: '新規取引先への挨拶メールを3パターン作成してください。パターン1: 非常に丁寧（大企業向け）、パターン2: 標準的なビジネス、パターン3: カジュアル（スタートアップ向け）。内容は自己紹介と今後の協業への期待です。',
        checkType: 'send_message',
      },
      {
        instruction: '3パターンの違いを比較しましょう。トーンや表現がどう変わるか確認してください',
        checkType: 'receive_response',
      },
      {
        instruction: '最も使いたいパターンをPDFで出力しましょう',
        checkType: 'pdf_generated',
      },
    ],
  },
  {
    id: 'intermediate-5',
    level: 'intermediate',
    number: 10,
    title: '会議の議事録を整理させる',
    description: '走り書きの会議メモをフジに渡して、構造化された議事録に変換させます',
    objective: 'AIに非構造データを構造化させるスキルを身につける',
    hint: '以下の会議メモを議事録として整理してください。\n\n4/17 定例ミーティング 参加: 田中、佐藤、鈴木\n・売上は目標達成 前月比15%増\n・新規案件 A社のシステム開発 来週提案\n・佐藤さんが見積書作成担当\n・鈴木さんは競合調査\n・次回は来週金曜 同じ時間\n・経費精算の締め切り 今月25日 忘れずに',
    estimatedTime: '5分',
    steps: [
      {
        instruction: '走り書きの会議メモをフジに送りましょう',
        hint: '以下の会議メモを議事録として整理してください。\n\n4/17 定例ミーティング 参加: 田中、佐藤、鈴木\n・売上は目標達成 前月比15%増\n・新規案件 A社のシステム開発 来週提案\n・佐藤さんが見積書作成担当\n・鈴木さんは競合調査\n・次回は来週金曜 同じ時間\n・経費精算の締め切り 今月25日 忘れずに',
        checkType: 'send_message',
      },
      {
        instruction: '決定事項・TODO・次回予定が整理されているか確認しましょう',
        checkType: 'receive_response',
      },
      {
        instruction: '議事録をPDFで出力して保存しましょう',
        checkType: 'pdf_generated',
      },
    ],
  },
];

const ALL_QUESTS: Quest[] = [...BEGINNER_QUESTS, ...INTERMEDIATE_QUESTS];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadProgress(): QuestProgress {
  try {
    const raw = localStorage.getItem(QUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuestProgress;
      return {
        completedQuests: Array.isArray(parsed.completedQuests) ? parsed.completedQuests : [],
        currentSteps: parsed.currentSteps && typeof parsed.currentSteps === 'object' ? parsed.currentSteps : {},
      };
    }
  } catch {
    // corrupted data — reset
  }
  return { completedQuests: [], currentSteps: {} };
}

function saveProgress(progress: QuestProgress): void {
  localStorage.setItem(QUEST_STORAGE_KEY, JSON.stringify(progress));
}

type QuestStatus = 'completed' | 'available' | 'locked';

function getQuestStatus(quest: Quest, progress: QuestProgress): QuestStatus {
  if (progress.completedQuests.includes(quest.id)) return 'completed';

  if (quest.level === 'beginner') {
    const idx = BEGINNER_QUESTS.findIndex((q) => q.id === quest.id);
    if (idx === 0) return 'available';
    const prevQuest = BEGINNER_QUESTS[idx - 1];
    if (prevQuest && progress.completedQuests.includes(prevQuest.id)) return 'available';
    return 'locked';
  }

  if (quest.level === 'intermediate') {
    // All beginner quests must be completed first
    const allBeginnersDone = BEGINNER_QUESTS.every((q) => progress.completedQuests.includes(q.id));
    if (!allBeginnersDone) return 'locked';
    const idx = INTERMEDIATE_QUESTS.findIndex((q) => q.id === quest.id);
    if (idx === 0) return 'available';
    const prevQuest = INTERMEDIATE_QUESTS[idx - 1];
    if (prevQuest && progress.completedQuests.includes(prevQuest.id)) return 'available';
    return 'locked';
  }

  return 'locked';
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

  const selectedQuest = useMemo(
    () => (selectedQuestId ? ALL_QUESTS.find((q) => q.id === selectedQuestId) ?? null : null),
    [selectedQuestId],
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2500);
  }, []);

  // Step toggling
  const toggleStep = useCallback(
    (questId: string, stepIndex: number) => {
      setProgress((prev) => {
        const quest = ALL_QUESTS.find((q) => q.id === questId);
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
    },
    [],
  );

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
        showToast('ヒントをコピーしました。AI事務員に貼り付けて送信してください。');
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
    const status = getQuestStatus(selectedQuest, progress);
    const stepStates = progress.currentSteps[selectedQuest.id] ?? new Array<boolean>(selectedQuest.steps.length).fill(false);
    const allStepsCompleted = stepStates.length === selectedQuest.steps.length && stepStates.every(Boolean);

    return (
      <div className="max-w-2xl mx-auto py-8">
        {/* Toast */}
        {toast && <Toast message={toast} />}

        {/* Back button */}
        <button
          type="button"
          onClick={() => setSelectedQuestId(null)}
          className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors duration-120"
          aria-label="クエスト一覧に戻る"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span>戻る</span>
        </button>

        {/* Quest header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-text-muted">Quest {selectedQuest.number}</span>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              selectedQuest.level === 'beginner'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-purple-100 text-purple-800'
            }`}>
              {selectedQuest.level === 'beginner' ? '初級' : '中級'}
            </span>
            <span className="flex items-center gap-1 text-xs text-text-muted">
              <Clock className="w-3 h-3" strokeWidth={1.5} />
              {selectedQuest.estimatedTime}
            </span>
          </div>
          <h2 className="text-xl font-semibold text-text-primary mb-2">{selectedQuest.title}</h2>
          <p className="text-sm text-text-secondary">{selectedQuest.objective}</p>
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
                      onClick={() => status === 'available' && toggleStep(selectedQuest.id, i)}
                      disabled={status !== 'available'}
                      className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded border transition-colors duration-120 flex items-center justify-center ${
                        checked
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-border hover:border-text-muted'
                      } ${status !== 'available' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      aria-label={`Step ${i + 1}: ${step.instruction}`}
                      aria-checked={checked}
                      role="checkbox"
                    >
                      {checked && <Check className="w-3 h-3" strokeWidth={2.5} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${checked ? 'text-text-muted line-through' : 'text-text-primary'}`}>
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
                          aria-label="ヒントをコピーしてAI事務員に移動"
                        >
                          <Copy className="w-3 h-3" strokeWidth={1.5} />
                          コピーしてAI事務員に送る
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
        {status === 'available' && (
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
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // List view
  // -----------------------------------------------------------------------
  const beginnerCompletedCount = progress.completedQuests.filter((id) =>
    BEGINNER_QUESTS.some((q) => q.id === id),
  ).length;
  const intermediateCompletedCount = progress.completedQuests.filter((id) =>
    INTERMEDIATE_QUESTS.some((q) => q.id === id),
  ).length;
  const totalCompleted = beginnerCompletedCount + intermediateCompletedCount;

  return (
    <div className="max-w-2xl mx-auto py-8">
      {/* Toast */}
      {toast && <Toast message={toast} />}

      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-text-primary">応用クエスト</h2>
        <p className="text-sm text-text-secondary mt-1">
          チュートリアルの次のステップ。本物のAIが動きます。
        </p>
        {totalCompleted > 0 && (
          <p className="text-xs text-text-muted mt-2">
            {totalCompleted} / {ALL_QUESTS.length} 完了
          </p>
        )}
      </div>

      {/* Beginner section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-text-primary">初級</h3>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">
            {beginnerCompletedCount} / {BEGINNER_QUESTS.length}
          </span>
        </div>
        <div className="space-y-3">
          {BEGINNER_QUESTS.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              progress={progress}
              onSelect={setSelectedQuestId}
            />
          ))}
        </div>
      </div>

      {/* Intermediate section */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-text-primary">中級</h3>
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">
            {intermediateCompletedCount} / {INTERMEDIATE_QUESTS.length}
          </span>
        </div>
        <div className="space-y-3">
          {INTERMEDIATE_QUESTS.map((quest) => (
            <QuestCard
              key={quest.id}
              quest={quest}
              progress={progress}
              onSelect={setSelectedQuestId}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center">
        <p className="text-xs text-text-muted">
          上級クエストは今後公開予定
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuestCard sub-component
// ---------------------------------------------------------------------------

interface QuestCardProps {
  quest: Quest;
  progress: QuestProgress;
  onSelect: (id: string) => void;
}

function QuestCard({ quest, progress, onSelect }: QuestCardProps) {
  const status = getQuestStatus(quest, progress);
  const isClickable = status === 'completed' || status === 'available';
  const levelBadge = quest.level === 'beginner'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-purple-100 text-purple-800';
  const levelLabel = quest.level === 'beginner' ? '初級' : '中級';

  return (
    <button
      type="button"
      onClick={() => isClickable && onSelect(quest.id)}
      disabled={!isClickable}
      className={`w-full text-left rounded-card border transition-colors duration-120 ${
        status === 'locked'
          ? 'border-border bg-base-surface opacity-60 cursor-not-allowed'
          : status === 'completed'
            ? 'border-emerald-200 bg-emerald-50/50 hover:border-emerald-300 cursor-pointer'
            : 'border-border bg-base-surface hover:border-accent/40 cursor-pointer'
      }`}
      aria-label={`Quest ${quest.number}: ${quest.title}`}
      aria-disabled={!isClickable}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        {/* Status indicator */}
        <div className="flex-shrink-0">
          {status === 'completed' && (
            <div
              className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center"
              aria-label="完了"
            >
              <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
          )}
          {status === 'available' && (
            <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
              <span className="text-xs font-semibold text-white">{quest.number}</span>
            </div>
          )}
          {status === 'locked' && (
            <div
              className="w-7 h-7 rounded-full bg-base-elevated flex items-center justify-center"
              aria-label="ロック中"
            >
              <Lock className="w-3.5 h-3.5 text-text-muted" strokeWidth={1.5} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className={`text-sm font-medium ${status === 'locked' ? 'text-text-muted' : 'text-text-primary'}`}>
              {quest.title}
            </p>
            <span className={`inline-flex items-center px-1 py-0.5 rounded text-[9px] font-semibold ${levelBadge}`}>
              {levelLabel}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{quest.description}</p>
        </div>

        {/* Time estimate */}
        <div className="flex-shrink-0 flex items-center gap-1 text-xs text-text-muted">
          <Clock className="w-3 h-3" strokeWidth={1.5} />
          {quest.estimatedTime}
        </div>

        {/* Chevron for clickable items */}
        {isClickable && (
          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" strokeWidth={1.5} />
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Toast sub-component
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
