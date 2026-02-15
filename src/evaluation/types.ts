export interface EvaluationResult {
  faithfulness: number | null;       // 0.0 〜 1.0
  answerRelevance: number | null;    // 0.0 〜 1.0
  /** RAG: コンテキスト活用度 — 取得した文書をどれだけ使ったか (0.0〜1.0) */
  contextUtilization: number | null;
  /** RAG: ハルシネーション率 — ソースにない情報の生成率 (0.0〜1.0, 低いほど良い) */
  hallucinationRate: number | null;
  /** RAGリクエストとして検出されたか */
  isRAG: boolean;
  evaluatedAt: string;               // ISO8601
  evaluationModel: string;
  error?: string;                    // 評価失敗時のエラーメッセージ
}

export interface EvaluationInput {
  question: string;
  answer: string;
  context?: string;  // RAGの場合の参照コンテキスト
}
