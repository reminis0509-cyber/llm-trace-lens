import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RoleProvider } from './contexts/RoleContext';
import { PlanProvider } from './contexts/PlanContext';
import { Auth } from './pages/Auth';
import { Dashboard, DashboardEntry } from './pages/Dashboard';
import { InviteAccept } from './pages/InviteAccept';
import { AdminRoute } from './pages/AdminRoute';
import { WatchRoom } from './pages/WatchRoom';

function isAdminPath(path: string): boolean {
  return path.startsWith('/dashboard/admin') || path.startsWith('/admin');
}

function isWatchRoomPath(path: string): boolean {
  return path.startsWith('/dashboard/watch') || path.startsWith('/watch');
}

/**
 * Resolve the in-dashboard entry view from the URL path. See AI Employee v1
 * (2026-04-20) for the route additions: /dashboard/briefing,
 * /dashboard/tasks, /dashboard/settings/connectors.
 *
 * v2 additions (2026-04-20): /dashboard/projects, /dashboard/projects/:id,
 * /dashboard/schedule, /dashboard/running, /dashboard/research,
 * /dashboard/settings/custom-mcp, /dashboard/settings/api-keys,
 * /dashboard/tools/web-app-builder.
 */
function resolveDashboardEntry(path: string): DashboardEntry {
  if (path.startsWith('/dashboard/briefing') || path.startsWith('/briefing')) {
    return { kind: 'tab', tab: 'briefing' };
  }
  if (path.startsWith('/dashboard/tasks') || path.startsWith('/tasks')) {
    return { kind: 'tab', tab: 'tasks' };
  }
  // --- v2 additions ---
  if (path.startsWith('/dashboard/projects/') || path.startsWith('/projects/')) {
    const match = path.match(/\/(?:dashboard\/)?projects\/([^/?#]+)/);
    const id = match ? decodeURIComponent(match[1]) : '';
    return { kind: 'project-detail', projectId: id };
  }
  if (path.startsWith('/dashboard/projects') || path.startsWith('/projects')) {
    return { kind: 'projects' };
  }
  if (path.startsWith('/dashboard/schedule') || path.startsWith('/schedule')) {
    return { kind: 'schedule' };
  }
  if (path.startsWith('/dashboard/running') || path.startsWith('/running')) {
    return { kind: 'running' };
  }
  if (path.startsWith('/dashboard/research') || path.startsWith('/research')) {
    return { kind: 'research' };
  }
  // v2.1 additions (2026-04-21): Slide Builder pivot + 3 new tools.
  // /tools/web-app-builder は後方互換として slide-builder 扱いで受ける。
  if (
    path.startsWith('/dashboard/tools/slide-builder') ||
    path.startsWith('/tools/slide-builder') ||
    path.startsWith('/dashboard/tools/web-app-builder') ||
    path.startsWith('/tools/web-app-builder')
  ) {
    return { kind: 'slide-builder' };
  }
  if (
    path.startsWith('/dashboard/tools/excel-analyzer') ||
    path.startsWith('/tools/excel-analyzer')
  ) {
    return { kind: 'excel-analyzer' };
  }
  if (
    path.startsWith('/dashboard/tools/meeting-transcriber') ||
    path.startsWith('/tools/meeting-transcriber')
  ) {
    return { kind: 'meeting-transcriber' };
  }
  if (
    path.startsWith('/dashboard/tools/document-proofreader') ||
    path.startsWith('/tools/document-proofreader')
  ) {
    return { kind: 'document-proofreader' };
  }
  if (
    path.startsWith('/dashboard/settings/custom-mcp') ||
    path.startsWith('/settings/custom-mcp')
  ) {
    return { kind: 'settings-sub', sub: 'custom-mcp' };
  }
  if (
    path.startsWith('/dashboard/settings/api-keys') ||
    path.startsWith('/settings/api-keys')
  ) {
    return { kind: 'settings-sub', sub: 'fujitrace-keys' };
  }
  if (
    path.startsWith('/dashboard/settings/connectors') ||
    path.startsWith('/settings/connectors')
  ) {
    return { kind: 'connectors' };
  }
  return { kind: 'tab' };
}

function isWatchDemoRequest(path: string, search: string): boolean {
  if (!isWatchRoomPath(path)) return false;
  const params = new URLSearchParams(search);
  return params.get('demo') === '1' || params.get('demo') === 'true';
}

function AppContent() {
  const { user, loading, error } = useAuth();
  const path = window.location.pathname;
  const search = window.location.search;

  // Handle invite accept route (accessible without login to show login prompt)
  // Supports both /dashboard/invite/accept (production) and /invite/accept (dev)
  if (path.startsWith('/dashboard/invite/accept') || path.startsWith('/invite/accept')) {
    return <InviteAccept />;
  }

  // Watch Room demo mode: public access, synthesized traces only, zero real data.
  // This lets Founder share the X demo video URL publicly and lets anyone
  // preview the monitoring experience without a login. Real-data access still
  // requires authentication (handled below after the user gate).
  if (isWatchDemoRequest(path, search)) {
    return (
      <RoleProvider initialWorkspaceId="demo">
        <PlanProvider>
          <WatchRoom />
        </PlanProvider>
      </RoleProvider>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <div className="text-text-muted text-sm">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base">
        <div className="text-center max-w-md p-6 surface-card">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-status-fail/10 flex items-center justify-center">
            <svg className="w-6 h-6 text-status-fail" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-status-fail mb-2">設定エラー</h1>
          <p className="text-text-secondary mb-4">{error}</p>
          <p className="text-sm text-text-muted">
            ビルド時に以下の環境変数が設定されていることを確認してください:
          </p>
          <ul className="text-sm text-text-muted mt-2 text-left list-disc list-inside">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  // Get workspace ID from URL query params or default
  const params = new URLSearchParams(window.location.search);
  const workspaceId = params.get('workspace') || 'default';

  // Direct admin route: /dashboard/admin or /admin (dev)
  if (isAdminPath(path)) {
    return (
      <RoleProvider initialWorkspaceId={workspaceId}>
        <PlanProvider>
          <AdminRoute />
        </PlanProvider>
      </RoleProvider>
    );
  }

  // Watch Room route: /dashboard/watch — fullscreen ambient monitoring mode
  // (Phase W0 prototype, see docs/戦略_2026.md Section 11)
  if (isWatchRoomPath(path)) {
    return (
      <RoleProvider initialWorkspaceId={workspaceId}>
        <PlanProvider>
          <WatchRoom />
        </PlanProvider>
      </RoleProvider>
    );
  }

  const entry = resolveDashboardEntry(path);

  return (
    <RoleProvider initialWorkspaceId={workspaceId}>
      <PlanProvider>
        <Dashboard entry={entry} />
      </PlanProvider>
    </RoleProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
