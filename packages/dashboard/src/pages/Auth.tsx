import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn, signUp, signInWithGoogle } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(email, password);
        if (error) {
          setError(error.message);
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          setError(error.message);
        } else {
          setMessage('確認メールを送信しました。メールを確認してください。');
        }
      }
    } catch (err) {
      setError('予期しないエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    const { error } = await signInWithGoogle();
    if (error) {
      setError(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="surface-card w-full max-w-md p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/dashboard/fujitrace-logo.png"
            alt="FujiTrace"
            className="h-12 mx-auto mb-4"
          />
          <p className="text-text-secondary mt-2">
            {isLogin ? 'アカウントにログイン' : '新しいアカウントを作成'}
          </p>
        </div>

        {/* Error/Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-status-pass/10 border border-status-pass/30 text-status-pass rounded-lg text-sm">
            {message}
          </div>
        )}

        {/* Google Sign In */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-border rounded-lg hover:bg-base-elevated transition mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-text-primary font-medium">Googleで続行</span>
        </button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-base-surface text-text-muted">またはメールで続行</span>
          </div>
        </div>

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2.5 bg-base-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 bg-base-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
              placeholder="パスワードを入力"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-accent text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-200 disabled:text-text-secondary disabled:cursor-not-allowed transition"
          >
            {loading ? '読み込み中...' : isLogin ? 'ログイン' : 'アカウント作成'}
          </button>
        </form>

        {/* Toggle */}
        <p className="mt-6 text-center text-sm text-text-secondary">
          {isLogin ? 'アカウントをお持ちでないですか？' : 'すでにアカウントをお持ちですか？'}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setMessage('');
            }}
            className="ml-1 text-accent font-medium hover:underline"
          >
            {isLogin ? 'アカウント作成' : 'ログイン'}
          </button>
        </p>
      </div>
    </div>
  );
}
