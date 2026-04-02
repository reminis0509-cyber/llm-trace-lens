import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, Users, LogIn } from 'lucide-react';
import { membersApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';

type Status = 'loading' | 'success' | 'error' | 'login-required';

export function InviteAccept() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setErrorMsg('URLに招待トークンが含まれていません');
      return;
    }

    // Wait for auth to complete
    if (authLoading) return;

    // If not logged in, show login required message
    if (!user) {
      setStatus('login-required');
      // Store token in sessionStorage to use after login
      sessionStorage.setItem('pendingInviteToken', token);
      return;
    }

    // Accept the invitation
    acceptInvitation(token);
  }, [user, authLoading]);

  const acceptInvitation = async (token: string) => {
    setStatus('loading');

    try {
      const result = await membersApi.acceptInvitation(token);
      setStatus('success');

      // Clear stored token
      sessionStorage.removeItem('pendingInviteToken');

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        window.location.href = `/dashboard?workspace=${result.workspaceId}`;
      }, 3000);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : '招待の承認に失敗しました');
    }
  };

  const handleLogin = () => {
    // Redirect to dashboard login page, keeping the current URL for redirect back
    window.location.href = `/dashboard?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base p-4">
      <div className="w-full max-w-md p-8 surface-card text-center">
        {status === 'loading' && (
          <>
            <div className="mb-6">
              <Loader2 className="w-16 h-16 text-accent animate-spin mx-auto" />
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              招待を処理中...
            </h2>
            <p className="text-text-muted">
              ワークスペースへの追加を処理しています。しばらくお待ちください。
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6">
              <div className="w-20 h-20 bg-status-pass/10 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-12 h-12 text-status-pass" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              ワークスペースに参加しました
            </h2>
            <p className="text-text-muted mb-6">
              ワークスペースへの参加が完了しました。
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
              <Loader2 className="w-4 h-4 animate-spin" />
              ダッシュボードにリダイレクト中...
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6">
              <div className="w-20 h-20 bg-status-fail/10 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-12 h-12 text-status-fail" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              招待の承認に失敗しました
            </h2>
            <p className="text-status-fail mb-6">
              {errorMsg}
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-base rounded-card font-medium hover:bg-accent/90 transition"
            >
              ダッシュボードへ
            </a>
          </>
        )}

        {status === 'login-required' && (
          <>
            <div className="mb-6">
              <div className="w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-12 h-12 text-accent" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-text-primary mb-2">
              ワークスペースに招待されました
            </h2>
            <p className="text-text-muted mb-6">
              ワークスペースに参加するには、ログインまたはアカウントの作成が必要です。
            </p>
            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-base rounded-card font-medium hover:bg-accent/90 transition"
            >
              <LogIn className="w-5 h-5" />
              ログイン / アカウント作成
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default InviteAccept;
