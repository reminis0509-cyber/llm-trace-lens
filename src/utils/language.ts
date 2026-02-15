/**
 * 言語検出ユーティリティ
 * franc (ESM) を dynamic import でラップして CommonJS 環境でも動作させる
 */

/** franc の ISO 639-3 コードを ISO 639-1 相当のラベルに変換するマップ */
const LANG_CODE_MAP: Record<string, string> = {
  jpn: 'ja',
  eng: 'en',
  zho: 'zh',
  kor: 'ko',
  fra: 'fr',
  deu: 'de',
  spa: 'es',
  por: 'pt',
  rus: 'ru',
  ara: 'ar',
  ita: 'it',
  nld: 'nl',
  pol: 'pl',
  tur: 'tr',
  vie: 'vi',
  tha: 'th',
};

let francModule: ((text: string, options?: { minLength?: number; only?: string[] }) => string) | null = null;

async function getFranc() {
  if (!francModule) {
    const mod = await import('franc');
    francModule = mod.franc;
  }
  return francModule;
}

/**
 * テキストの言語を検出する
 * @param text 検出対象テキスト
 * @returns ISO 639-1 相当の言語コード（例: 'ja', 'en'）または 'unknown'
 */
export async function detectLanguage(text: string): Promise<string> {
  if (!text || text.trim().length < 10) return 'unknown';

  // 日本語の文字（ひらがな・カタカナ・漢字）が含まれていれば高速判定
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text)) {
    return 'ja';
  }

  // 韓国語（ハングル）の高速判定
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(text)) {
    return 'ko';
  }

  try {
    const franc = await getFranc();
    const detected = franc(text, { minLength: 10 });
    if (detected === 'und') return 'unknown';
    return LANG_CODE_MAP[detected] ?? detected.slice(0, 2);
  } catch {
    return 'unknown';
  }
}

/**
 * 2つのテキストの言語が一致するか確認する
 * @returns 一致しない場合は不一致情報を返す、一致する場合は null
 */
export async function checkLanguageMismatch(
  inputText: string,
  outputText: string
): Promise<{ inputLang: string; outputLang: string } | null> {
  const [inputLang, outputLang] = await Promise.all([
    detectLanguage(inputText),
    detectLanguage(outputText),
  ]);

  if (inputLang === 'unknown' || outputLang === 'unknown') return null;
  if (inputLang === outputLang) return null;

  return { inputLang, outputLang };
}
