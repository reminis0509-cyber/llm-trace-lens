export interface EvaluationResult {
  faithfulness: number | null;       // 0.0 〜 1.0
  answerRelevance: number | null;    // 0.0 〜 1.0
  evaluatedAt: string;               // ISO8601
  evaluationModel: string;
  error?: string;                    // 評価失敗時のエラーメッセージ
}

export interface EvaluationInput {
  question: string;
  answer: string;
  context?: string;  // RAGの場合の参照コンテキスト
}
