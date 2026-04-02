import { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Trash2, Crown, Shield, User, Copy, Check, Link2, X } from 'lucide-react';
import { membersApi, type WorkspaceMember, type Role, type Invitation } from '../api/client';
import { useRole } from '../contexts/RoleContext';

interface MembersProps {
  workspaceId: string;
  onBack?: () => void;
}

export function Members({ workspaceId, onBack }: MembersProps) {
  const { isOwner, isAdmin, refresh: refreshRole } = useRole();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isCreatingInvite, setIsCreatingInvite] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  const loadData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);

    try {
      const [membersData, invitationsData] = await Promise.all([
        membersApi.getMembers(workspaceId),
        isAdmin ? membersApi.getInvitations(workspaceId).catch(() => []) : Promise.resolve([]),
      ]);
      setMembers(membersData);
      setInvitations(invitationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバーの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, isAdmin]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateInvite = async () => {
    setIsCreatingInvite(true);
    setError(null);

    try {
      const result = await membersApi.createInvitation(
        workspaceId,
        inviteEmail || undefined
      );
      setInviteLink(result.inviteLink);
      setInviteEmail('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待の作成に失敗しました');
    } finally {
      setIsCreatingInvite(false);
    }
  };

  const handleCopyLink = () => {
    if (inviteLink) {
      navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`${memberEmail}をこのワークスペースから削除してもよろしいですか？`)) return;

    try {
      await membersApi.removeMember(workspaceId, memberId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'メンバーの削除に失敗しました');
    }
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    try {
      await membersApi.updateRole(workspaceId, memberId, newRole);
      await loadData();
      // Refresh current user's role in case it changed
      await refreshRole();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ロールの更新に失敗しました');
    }
  };

  const handleRevokeInvitation = async (token: string) => {
    if (!confirm('この招待を取消してもよろしいですか？')) return;

    try {
      await membersApi.revokeInvitation(workspaceId, token);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待の取消に失敗しました');
    }
  };

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'owner':
        return <Crown className="w-4 h-4 text-yellow-500" />;
      case 'admin':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <User className="w-4 h-4 text-text-secondary" />;
    }
  };

  const getRoleBadgeClass = (role: Role) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-base-elevated text-text-secondary';
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-lg hover:bg-base-elevated transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="p-2 bg-accent-dim rounded-lg">
            <Users className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">チームメンバー</h1>
            <p className="text-sm text-text-secondary">
              ワークスペースのメンバーと招待を管理
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-700 transition"
          >
            <UserPlus className="w-4 h-4" />
            メンバーを招待
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-red-500 hover:text-red-600 underline"
          >
            閉じる
          </button>
        </div>
      )}

      {/* Invite Form */}
      {showInviteForm && isAdmin && (
        <div className="mb-6 p-6 bg-base rounded-xl border border-border">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            招待リンクを作成
          </h2>

          <div className="flex gap-3 mb-4">
            <input
              type="email"
              placeholder="メールアドレス（任意 - 空欄でリンクのみ）"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 px-4 py-2 border border-border rounded-lg bg-base text-text-primary placeholder-text-muted"
            />
            <button
              onClick={handleCreateInvite}
              disabled={isCreatingInvite}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isCreatingInvite ? '作成中...' : 'リンクを生成'}
            </button>
          </div>

          {inviteLink && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-600 mb-2">
                このリンクを招待したい方に共有してください：
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-base rounded border border-green-200 text-sm break-all">
                  {inviteLink}
                </code>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'コピーしました！' : 'コピー'}
                </button>
              </div>
              <p className="mt-2 text-xs text-text-muted">
                このリンクは7日間有効です。
              </p>
            </div>
          )}
        </div>
      )}

      {/* Members List */}
      <div className="bg-base rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-text-primary">
            メンバー ({members.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted">メンバーを読み込み中...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-text-muted">メンバーが見つかりません</div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div
                key={member.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-base-elevated transition"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-base-elevated rounded-full flex items-center justify-center">
                    {getRoleIcon(member.role)}
                  </div>
                  <div>
                    <p className="font-medium text-text-primary">
                      {member.email}
                    </p>
                    <p className="text-sm text-text-muted">
                      参加日 {new Date(member.created_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      {member.invited_by && ` | 招待元 ${member.invited_by}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {isOwner ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleRoleChange(member.id, e.target.value as Role)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border-0 cursor-pointer ${getRoleBadgeClass(member.role)}`}
                    >
                      <option value="owner">オーナー</option>
                      <option value="admin">管理者</option>
                      <option value="member">メンバー</option>
                    </select>
                  ) : (
                    <span className={`px-3 py-1.5 rounded-lg text-sm font-medium ${getRoleBadgeClass(member.role)}`}>
                      {member.role === 'owner' ? 'オーナー' : member.role === 'admin' ? '管理者' : 'メンバー'}
                    </span>
                  )}

                  {isAdmin && (
                    <button
                      onClick={() => handleRemoveMember(member.id, member.email)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="メンバーを削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {isAdmin && invitations.length > 0 && (
        <div className="mt-6 bg-base rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-semibold text-text-primary">
              保留中の招待 ({invitations.length})
            </h2>
          </div>

          <div className="divide-y divide-border">
            {invitations.map((invitation) => (
              <div
                key={invitation.token}
                className="px-6 py-4 flex items-center justify-between hover:bg-base-elevated transition"
              >
                <div>
                  <p className="font-medium text-text-primary">
                    {invitation.email || 'リンクを知っている人全員'}
                  </p>
                  <p className="text-sm text-text-muted">
                    招待元 {invitation.invited_by_email} |
                    有効期限 {new Date(invitation.expires_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </p>
                </div>

                <button
                  onClick={() => handleRevokeInvitation(invitation.token)}
                  className="flex items-center gap-1 px-3 py-1.5 text-red-500 hover:bg-red-50 rounded-lg transition text-sm"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Members;
