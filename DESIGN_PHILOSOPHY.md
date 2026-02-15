# LLM Trace Lens 設計思想

## 1. 今すぐ価値：プロンプト強制＋ルール検証で今日から使える

LLM Trace Lensは、複雑な設定や長期的な統合を必要とせず、**即座に価値を提供する**ことを最優先に設計されています。

### プロンプト強制による構造化
すべてのLLMリクエストに対して、システムプロンプトを自動注入することで、以下の構造化されたレスポンスを強制します:

```json
{
  "answer": "実際の回答内容",
  "confidence": 85,
  "evidence": ["根拠1", "根拠2", "根拠3"],
  "alternatives": ["代替案1", "代替案2"]
}
```

この構造化により、LLMの出力が機械的に検証可能になります。

### ルールベース検証
取得した構造化レスポンスに対して、2段階の検証を実施します:

1. **信頼度検証 (ConfidenceValidator)**
   - 低信頼度（< 50）の回答を警告
   - 高信頼度なのにエビデンスが少ない矛盾を検出

2. **リスクスキャン (RiskScanner)**
   - PII（クレジットカード、SSN、メールアドレス）の検出
   - センシティブ情報の漏洩を防止

検証結果は PASS / WARN / BLOCK の3段階で評価され、アプリケーション側で適切な対応が可能です。

### 今日から使える理由
- OpenAI互換APIとして動作（既存コードの1行変更で導入可能）
- SQLiteによるゼロ構成のストレージ
- Reactダッシュボードで即座に可視化


## 2. 将来の布石：internalTrace: null はL3/L4標準化時の差し替え口

現在のMVPでは、トレースオブジェクトに `internalTrace: null` フィールドを含めています。これは将来の拡張性を担保するための設計です。

### 現在の制約
- プロンプト強制による構造化は、LLM側のネイティブ機能ではない
- 信頼度やエビデンスは「LLMに書かせている」に過ぎず、真の信頼性評価ではない

### 将来の展望（L3/L4標準化）
業界標準として、以下のような「内部トレース」機能が実装される可能性があります:
- **OpenAI**: logprobs、reasoning_tokens（o1モデル）
- **Anthropic**: Extended Thinking、Citation Metadata
- **Google**: Grounding Metadata、Search Quality Signals

これらが利用可能になった際、`internalTrace` フィールドを差し替えるだけで、真の信頼性評価が可能になります。

### 差し替え例

```typescript
// 現在
const trace = {
  // ...
  internalTrace: null
};

// 将来（OpenAI o1のreasoning_tokensが利用可能になった場合）
const trace = {
  // ...
  internalTrace: {
    provider: 'openai',
    reasoning_tokens: response.usage.reasoning_tokens,
    completion_tokens_details: response.usage.completion_tokens_details
  }
};
```

この設計により、MVPを捨てずに進化させることができます。


## 3. ベンダーフリー：OpenAI互換APIで全プロバイダ同一インターフェース

LLM Trace Lensは、プロバイダに依存しない設計を採用しています。

### 統一されたインターフェース
クライアント側は常に同じリクエスト形式を使用します:

```typescript
fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    provider: 'openai',  // または 'anthropic', 'gemini', 'deepseek'
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }]
  })
});
```

### プロバイダの追加が容易
新しいプロバイダを追加する際は、以下の2ステップのみ:
1. `src/enforcer/<provider>.ts` を実装
2. `src/enforcer/factory.ts` にケースを追加

既存コードの変更は不要です。

### ベンダーロックイン回避
- 特定のLLMプロバイダに依存しない
- プロバイダ間の移行が容易（1パラメータの変更のみ）
- マルチプロバイダ戦略が実現可能（コスト最適化、冗長性確保）


## まとめ

LLM Trace Lensの設計思想は、**実用性**、**拡張性**、**独立性**の3本柱で支えられています。

1. **今すぐ価値**: 複雑な設定不要で、即座にLLM出力を可観測化
2. **将来の布石**: 標準化された内部トレース機能への移行パスを確保
3. **ベンダーフリー**: OpenAI互換APIによるプロバイダ非依存設計

この設計により、LLM Trace Lensは**今日使えて、明日も使える**プロダクトとして進化し続けます。
