import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { membersApi, type Role } from '../api/client';
import { useAuth } from './AuthContext';

interface RoleContextValue {
  role: Role | null;
  loading: boolean;
  error: string | null;
  isOwner: boolean;
  isAdmin: boolean;
  isMember: boolean;
  hasAccess: boolean;
  workspaceId: string | null;
  setWorkspaceId: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  loading: false,
  error: null,
  isOwner: false,
  isAdmin: false,
  isMember: false,
  hasAccess: false,
  workspaceId: null,
  setWorkspaceId: () => {},
  refresh: async () => {},
});

interface RoleProviderProps {
  children: ReactNode;
  initialWorkspaceId?: string;
}

export function RoleProvider({ children, initialWorkspaceId }: RoleProviderProps) {
  const { user } = useAuth();
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(initialWorkspaceId || null);

  const fetchRole = useCallback(async () => {
    if (!workspaceId || !user) {
      setRole(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await membersApi.getMyRole(workspaceId);
      setRole(data.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch role');
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, user]);

  // Fetch role when workspace or user changes
  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const value: RoleContextValue = {
    role,
    loading,
    error,
    isOwner: role === 'owner',
    isAdmin: role === 'owner' || role === 'admin',
    isMember: role !== null,
    hasAccess: role !== null,
    workspaceId,
    setWorkspaceId,
    refresh: fetchRole,
  };

  return (
    <RoleContext.Provider value={value}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}

/**
 * Hook to check if user has required role
 */
export function useRequireRole(requiredRole: Role): { hasPermission: boolean; loading: boolean } {
  const { role, loading } = useRole();

  const roleHierarchy: Record<Role, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  };

  const hasPermission = role !== null && roleHierarchy[role] >= roleHierarchy[requiredRole];

  return { hasPermission, loading };
}
