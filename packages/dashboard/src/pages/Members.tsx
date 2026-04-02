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
        return <User className="w-4 h-4 text-gray-400" />;
    }
  };

  const getRoleBadgeClass = (role: Role) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
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
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-lg">
            <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">チームメンバー</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              ワークスペースのメンバーと招待を管理
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            <UserPlus className="w-4 h-4" />
            メンバーを招待
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400">{error}</p>
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
        <div className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
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
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
            <button
              onClick={handleCreateInvite}
              disabled={isCreatingInvite}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isCreatingInvite ? '作成中...' : 'リンクを生成'}
            </button>
          </div>

          {inviteLink && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-600 dark:text-green-400 mb-2">
                このリンクを招待したい方に共有してください：
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-white dark:bg-gray-800 rounded border border-green-200 dark:border-green-800 text-sm break-all">
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
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                このリンクは7日間有効です。
              </p>
            </div>
          )}
        </div>
      )}

      {/* Members List */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            メンバー ({members.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500">メンバーを読み込み中...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-gray-500">メンバーが見つかりません</div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {members.map((member) => (
              <div
                key={member.id}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    {getRoleIcon(member.role)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {member.email}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
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
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
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
        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              保留中の招待 ({invitations.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {invitations.map((invitation) => (
              <div
                key={invitation.token}
                className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {invitation.email || 'リンクを知っている人全員'}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    招待元 {invitation.invited_by_email} |
                    有効期限 {new Date(invitation.expires_at).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                  </p>
                </div>

                <button
                  onClick={() => handleRevokeInvitation(invitation.token)}
                  className="flex items-center gap-1 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition text-sm"
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
