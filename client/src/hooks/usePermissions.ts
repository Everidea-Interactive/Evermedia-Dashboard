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

  // Admin - All permissions
  const canManageUsers = (): boolean => {
    return isAdmin();
  };

  // Admin, Campaign Manager - Can manage campaigns
  const canManageCampaigns = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER']);
  };

  // Admin, Campaign Manager - Can manage accounts (create, edit, delete)
  // Editor - Can add/edit accounts (no delete)
  const canManageAccounts = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER']);
  };

  // Admin, Campaign Manager, Editor - Can add/edit accounts
  const canAddAccount = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR']);
  };

  const canEditAccount = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR']);
  };

  // Admin, Campaign Manager, Editor - Can add/edit PICs
  const canManagePics = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR']);
  };

  // Admin, Campaign Manager - Can manage posts (full CRUD)
  // Editor - Can only add/edit posts (no delete)
  const canAddPost = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR']);
  };

  const canEditPost = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR']);
  };

  const canDeletePost = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER']);
  };

  // Legacy method for backward compatibility - checks if can add/edit posts
  const canManagePosts = (): boolean => {
    return canAddPost();
  };

  // All roles can view reports
  const canViewReports = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR', 'VIEWER']);
  };

  // Admin, Campaign Manager - Can edit (except posts which use canEditPost)
  // Editor - Can only edit posts
  const canEdit = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER']);
  };

  // Admin, Campaign Manager - Can delete (except posts which use canDeletePost)
  const canDelete = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER']);
  };

  // Check if user can perform any CRUD operation
  const canPerformCRUD = (): boolean => {
    return hasAnyRole(['ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR']);
  };

  return {
    user,
    hasRole,
    hasAnyRole,
    isAdmin,
    canManageUsers,
    canManageCampaigns,
    canManageAccounts,
    canAddAccount,
    canEditAccount,
    canManagePics,
    canAddPost,
    canEditPost,
    canDeletePost,
    canManagePosts, // Legacy - use canAddPost/canEditPost instead
    canViewReports,
    canEdit,
    canDelete,
    canPerformCRUD,
  };
}


