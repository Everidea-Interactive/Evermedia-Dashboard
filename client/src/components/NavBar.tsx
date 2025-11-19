import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../hooks/usePermissions';

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { canManageUsers } = usePermissions();
  return (
    <div className="w-full bg-white border-b shadow-sm sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/campaigns" className="font-semibold text-gray-900">TikTok Proxy Account Dashboard</Link>
          <nav className="flex items-center gap-3 text-sm text-gray-600">
            <Link to="/campaigns" className="hover:text-black">Campaigns</Link>
            <Link to="/accounts" className="hover:text-black">Accounts</Link>
            <Link to="/pics" className="hover:text-black">PICs</Link>
            {canManageUsers() && (
              <Link to="/users" className="hover:text-black">Users</Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {user && <span className="text-gray-600">{user.name} · {user.role}</span>}
          <button className="px-3 py-1.5 border rounded hover:bg-gray-50" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
        </div>
      </div>
    </div>
  );
}

