import { usePermissions } from '../hooks/usePermissions';

interface RequirePermissionProps {
  children: React.ReactNode;
  permission: () => boolean;
  fallback?: React.ReactNode;
}

export default function RequirePermission({ children, permission, fallback }: RequirePermissionProps) {
  const perms = usePermissions();

  if (!permission.call(perms)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return null;
  }

  return <>{children}</>;
}

