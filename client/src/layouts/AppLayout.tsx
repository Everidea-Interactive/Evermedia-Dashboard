import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen grid grid-cols-12">
      <aside className="hidden md:block col-span-3 lg:col-span-2 border-r bg-white">
        <div className="h-16 flex items-center px-4 border-b">
          <div className="h-9 w-9 rounded-lg bg-indigo-600/10 grid place-items-center text-indigo-700 font-semibold">TK</div>
          <div className="ml-3">
            <div className="font-semibold leading-tight">TikTok Dashboard</div>
            <div className="text-xs text-gray-500">Proxy Accounts</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          <SideLink to="/campaigns" label="Campaigns" />
          <SideLink to="/accounts" label="Accounts" />
          <SideLink to="/pics" label="PICs" />
        </nav>
        <div className="p-3">
          <Link to="/posts/new" className="btn btn-primary w-full text-center text-sm">
            Add new Post
          </Link>
        </div>
      </aside>
      <div className="col-span-12 md:col-span-9 lg:col-span-10 flex flex-col">
        <header className="h-16 border-b bg-gradient-to-r from-white to-indigo-50/40">
          <div className="container-pro h-full flex items-center justify-between">
            <div className="flex items-center gap-2 md:hidden">
              <div className="h-9 w-9 rounded-lg bg-indigo-600/10 grid place-items-center text-indigo-700 font-semibold">TK</div>
              <span className="font-semibold">TikTok Dashboard</span>
            </div>
            <div className="hidden md:block text-sm text-gray-600">Welcome{user ? `, ${user.name}` : ''}</div>
            <div className="flex items-center gap-2">
              {user && <span className="hidden sm:block text-xs text-gray-600 px-2 py-1 rounded-full bg-gray-100 border">{user.role}</span>}
              <button className="btn btn-outline" onClick={() => { logout(); navigate('/login'); }}>Logout</button>
            </div>
          </div>
        </header>
        <main className="flex-1">
          <div className="container-pro py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SideLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-sm ${isActive ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`
      }
    >
      {label}
    </NavLink>
  );
}
