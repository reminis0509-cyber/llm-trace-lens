import { ArrowLeft, LogOut } from 'lucide-react';
import { useRole } from '../contexts/RoleContext';
import { useAuth } from '../contexts/AuthContext';
import { AdminDashboard } from './AdminDashboard';
import { ErrorBoundary } from '../components/ErrorBoundary';

export function AdminRoute() {
  const { isSystemAdmin, loading } = useRole();
  const { user, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-text-muted">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isSystemAdmin) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="surface-card p-8 max-w-sm text-center">
          <p className="text-sm text-status-fail mb-4">管理者権限がありません</p>
          <a
            href="/dashboard/"
            className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 transition-colors duration-120"
          >
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            ダッシュボードに戻る
          </a>
        </div>
      </div>
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

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
              onClick={handleSignOut}
              className="p-2 text-text-muted hover:text-status-fail hover:bg-status-fail/10 rounded-card transition-colors duration-120"
              title="ログアウト"
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
