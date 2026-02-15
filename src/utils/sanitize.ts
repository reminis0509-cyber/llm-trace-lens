/**
 * Input Sanitization Utilities
 * SQLインジェクション・XSS対策の追加防御層
 *
 * 注意: KnexのQuery Builderがパラメータ化クエリを使用しているため
 * SQLインジェクションは基本的に防止されています。
 * これは二重防御（Defense in Depth）のための追加レイヤーです。
 */

/**
 * SQLインジェクションパターン
 * 注意: .test() と併用するため /g フラグは使用しない（lastIndex問題回避）
 */
const SQL_INJECTION_PATTERNS = [
  /(['";])\s*(OR|AND)\s+\d+\s*=\s*\d+/i,         // ' OR 1=1
  /(['";])\s*(OR|AND)\s+['"].*['"]\s*=\s*['"]/i,  // ' OR 'a'='a
  /UNION\s+(ALL\s+)?SELECT/i,                      // UNION SELECT
  /;\s*(DROP|DELETE|UPDATE|INSERT|ALTER)/i,         // ; DROP TABLE
  /--\s*$/m,                                        // SQL comment at end
  /\/\*[\s\S]*?\*\//,                               // /* comment */
  /\bEXEC\s*\(/i,                                   // EXEC(
  /\bXP_/i,                                         // xp_cmdshell etc
];

/**
 * XSSパターン
 * 注意: .test() と併用するため /g フラグは使用しない
 */
const XSS_PATTERNS = [
  /<script[\s\S]*?>[\s\S]*?<\/script>/i,
  /javascript:/i,
  /on\w+\s*=/i,                                    // onclick=, onerror=, etc
  /<iframe[\s\S]*?>/i,
  /<object[\s\S]*?>/i,
  /<embed[\s\S]*?>/i,
];

/**
 * 入力文字列が危険なパターンを含むかチェック
 */
export function containsSQLInjection(input: string): boolean {
  if (typeof input !== 'string') return false;
  return SQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * 入力文字列がXSSパターンを含むかチェック
 */
export function containsXSS(input: string): boolean {
  if (typeof input !== 'string') return false;
  return XSS_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * 入力が安全かどうかをチェック
 */
export function isInputSafe(input: string): { safe: boolean; reason?: string } {
  if (typeof input !== 'string') {
    return { safe: true };
  }

  if (containsSQLInjection(input)) {
    return { safe: false, reason: 'Potential SQL injection detected' };
  }

  if (containsXSS(input)) {
    return { safe: false, reason: 'Potential XSS attack detected' };
  }

  return { safe: true };
}

/**
 * オブジェクトの全フィールドをチェック
 */
export function validateObject(obj: Record<string, unknown>): { safe: boolean; field?: string; reason?: string } {
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      const result = isInputSafe(value);
      if (!result.safe) {
        return { safe: false, field: key, reason: result.reason };
      }
    } else if (typeof value === 'object' && value !== null) {
      const result = validateObject(value as Record<string, unknown>);
      if (!result.safe) {
        return { safe: false, field: `${key}.${result.field}`, reason: result.reason };
      }
    }
  }
  return { safe: true };
}

/**
 * ワークスペースIDのバリデーション
 * 英数字、ハイフン、アンダースコアのみ許可
 */
export function isValidWorkspaceId(id: string): boolean {
  if (typeof id !== 'string') return false;
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

/**
 * APIキーのフォーマットバリデーション
 */
export function isValidApiKeyFormat(key: string): boolean {
  if (typeof key !== 'string') return false;
  // ltl_xxxxxx or sk-xxx or sk-ant-xxx etc
  return /^(ltl_[a-f0-9]{48}|sk-[a-zA-Z0-9_-]{20,}|sk-ant-[a-zA-Z0-9_-]{20,})$/.test(key);
}

/**
 * メールアドレスの基本バリデーション
 */
export function isValidEmail(email: string): boolean {
  if (typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}
