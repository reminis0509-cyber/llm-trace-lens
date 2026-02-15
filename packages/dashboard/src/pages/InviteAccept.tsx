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
      setErrorMsg('Invitation token not found in URL');
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
      setErrorMsg(err instanceof Error ? err.message : 'Failed to accept invitation');
    }
  };

  const handleLogin = () => {
    // Redirect to login page, keeping the current URL for redirect back
    window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg text-center">
        {status === 'loading' && (
          <>
            <div className="mb-6">
              <Loader2 className="w-16 h-16 text-indigo-500 animate-spin mx-auto" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Processing Invitation...
            </h2>
            <p className="text-gray-500 dark:text-gray-400">
              Please wait while we add you to the workspace.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mb-6">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Welcome to the Team!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              You have successfully joined the workspace.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400 dark:text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirecting to dashboard...
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mb-6">
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                <XCircle className="w-12 h-12 text-red-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Invitation Failed
            </h2>
            <p className="text-red-500 dark:text-red-400 mb-6">
              {errorMsg}
            </p>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Go to Dashboard
            </a>
          </>
        )}

        {status === 'login-required' && (
          <>
            <div className="mb-6">
              <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto">
                <Users className="w-12 h-12 text-indigo-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              You've Been Invited!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Please log in or create an account to join this workspace.
            </p>
            <button
              onClick={handleLogin}
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <LogIn className="w-5 h-5" />
              Login / Sign Up
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default InviteAccept;
