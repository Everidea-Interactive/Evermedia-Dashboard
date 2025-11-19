import { useAuth } from '../context/AuthContext';

export type Role = 'ADMIN' | 'CAMPAIGN_MANAGER' | 'EDITOR' | 'VIEWER';

// Export as const array for runtime use if needed
export const ROLES: Role[] = ['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR', 'VIEWER'];

export function usePermissions() {
  const { user } = useAuth();

  const hasRole = (role: Role): boolean => {
    if (!user || !user.role) return false;
    // Case-insensitive comparison to handle any case variations
    return user.role.toUpperCase() === role.toUpperCase();
  };

  const hasAnyRole = (roles: Role[]): boolean => {
    if (!user || !user.role) return false;
    // Case-insensitive comparison
    const userRoleUpper = user.role.toUpperCase();
    return roles.some(role => role.toUpperCase() === userRoleUpper);
  };

  const isAdmin = (): boolean => {
    if (!user || !user.role) return false;
    return user.role.toUpperCase() === 'ADMIN';
  };

  const canManageUsers = (): boolean => {
    return isAdmin();
  };

  const canManageCampaigns = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER']);
  };

  const canManageAccounts = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR']);
  };

  const canManagePosts = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR']);
  };

  const canViewReports = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR', 'VIEWER']);
  };

  const canEdit = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR']);
  };

  const canDelete = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER']);
  };

  return {
    user,
    hasRole,
    hasAnyRole,
    isAdmin,
    canManageUsers,
    canManageCampaigns,
    canManageAccounts,
    canManagePosts,
    canViewReports,
    canEdit,
    canDelete,
  };
}

