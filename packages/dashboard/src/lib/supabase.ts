import { createClient, SupabaseClient } from '@supabase/supabase-js';

// 環境変数から取得（フォールバックなし — OSS安全性のため必須設定）
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Supabaseが設定されているかチェック
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL と VITE_SUPABASE_ANON_KEY が設定されていません。',
    'Supabase連携機能は無効です。.env ファイルに設定してください。'
  );
}

// Create Supabase client（未設定時はダミーURLで初期化、isSupabaseConfiguredで利用前にガード）
function createSupabaseClient(): SupabaseClient {
  return createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key'
  );
}

export const supabase = createSupabaseClient();
