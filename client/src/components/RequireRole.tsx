import { Navigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';
import type { Role } from '../hooks/usePermissions';

interface RequireRoleProps {
  children: React.ReactNode;
  roles: Role[];
  fallback?: React.ReactNode;
}

export default function RequireRole({ children, roles, fallback }: RequireRoleProps) {
  const { hasAnyRole } = usePermissions();

  if (!hasAnyRole(roles)) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return <Navigate to="/campaigns" replace />;
  }

  return <>{children}</>;
}

