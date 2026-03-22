import { useState, useEffect, useCallback, FormEvent } from 'react';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useRole } from '../contexts/RoleContext';
import { useAuth } from '../contexts/AuthContext';
import { adminApi } from '../api/admin';
import { AdminDashboard } from './AdminDashboard';
import { ErrorBoundary } from '../components/ErrorBoundary';

export function AdminRoute() {
  const { loading } = useRole();
  const { user, signOut } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingToken, setIsCheckingToken] = useState(true);

  // On mount, check if there's a valid token in sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem('fujitrace_admin_token');
    if (token) {
      adminApi.checkAdmin()
        .then(data => {
          if (data.isAdmin) {
            setIsAuthenticated(true);
          } else {
            sessionStorage.removeItem('fujitrace_admin_token');
          }
        })
        .catch(() => {
          sessionStorage.removeItem('fujitrace_admin_token');
        })
        .finally(() => setIsCheckingToken(false));
    } else {
      setIsCheckingToken(false);
    }
  }, []);

  const handleLogin = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await adminApi.login(email, password);
      if (result.success && result.token) {
        sessionStorage.setItem('fujitrace_admin_token', result.token);
        setIsAuthenticated(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  }, [email, password]);

  const handleLogout = useCallback(async () => {
    adminApi.logout();
    setIsAuthenticated(false);
    setEmail('');
    setPassword('');
    await signOut();
  }, [signOut]);

  if (loading || isCheckingToken) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-navy-900 bg-grid flex items-center justify-center p-4">
        <div className="glass-card w-full max-w-md p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-accent-cyan to-accent-emerald flex items-center justify-center">
              <svg className="w-8 h-8" viewBox="0 0 32 32" fill="none">
                <path d="M11.5 8 L7 22 L9.2 22 L11.5 14.5 L13.8 22 L16 22 Z" fill="#93c5fd"/>
                <path d="M20 10.5 L16.2 22 L18.4 22 L20 15.5 L21.6 22 L23.8 22 Z" fill="#60a5fa"/>
                <path d="M16 22 L15.2 22 L16 19.2 Z" fill="#2563eb" opacity="0.7"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-100 tracking-wide">FujiTrace</h1>
            <p className="text-gray-400 mt-2">管理者ログイン</p>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="admin-email">
                メールアドレス
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="管理者メールアドレス"
                className="w-full px-4 py-2.5 bg-base-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="admin-password">
                パスワード
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="管理者パスワード"
                className="w-full px-4 py-2.5 bg-base-surface border border-border rounded-lg text-text-primary placeholder-text-muted focus:ring-2 focus:ring-accent/50 focus:border-accent transition"
                placeholder="パスワードを入力"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              aria-label="ログインする"
              className="w-full py-3 bg-accent-cyan text-navy-900 rounded-lg font-semibold hover:bg-accent-cyan-dim disabled:bg-navy-600 disabled:text-gray-400 disabled:cursor-not-allowed transition"
            >
              {isLoading ? '読み込み中...' : 'ログイン'}
            </button>
          </form>

          {/* Back link */}
          <p className="mt-6 text-center">
            <a
              href="/dashboard/"
              className="inline-flex items-center gap-2 text-sm text-accent-cyan hover:underline"
            >
              <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
              ダッシュボードに戻る
            </a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <header className="h-12 bg-base-surface border-b border-border sticky top-0 z-50">
        <div className="h-full px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <svg className="w-5 h-5" viewBox="0 0 32 32" fill="none">
              <path d="M11.5 8 L7 22 L9.2 22 L11.5 14.5 L13.8 22 L16 22 Z" fill="#93c5fd"/>
              <path d="M20 10.5 L16.2 22 L18.4 22 L20 15.5 L21.6 22 L23.8 22 Z" fill="#60a5fa"/>
              <path d="M16 22 L15.2 22 L16 19.2 Z" fill="#2563eb" opacity="0.7"/>
            </svg>
            <a
              href="/dashboard/"
              className="flex items-center gap-1.5 text-nav text-text-secondary hover:text-text-primary transition-colors duration-120"
            >
              <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>ダッシュボード</span>
            </a>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-text-muted truncate max-w-[150px]">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="p-2 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
              title="ログアウト"
              aria-label="管理者ログアウト"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6 sm:p-10">
        <ErrorBoundary>
          <AdminDashboard />
        </ErrorBoundary>
      </main>
    </div>
  );
}
