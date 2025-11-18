import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen grid grid-cols-12" style={{ backgroundColor: 'var(--bg-primary)', transition: 'background-color 0.2s ease' }}>
      <aside className="hidden md:block col-span-3 lg:col-span-2 border-r" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)', transition: 'background-color 0.2s ease, border-color 0.2s ease' }}>
        <div className="h-16 flex items-center px-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <div className="h-9 w-9 rounded-lg grid place-items-center font-semibold" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>TK</div>
          <div className="ml-3">
            <div className="font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>TikTok Dashboard</div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Proxy Accounts</div>
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
        <header className="h-16 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)', transition: 'background-color 0.2s ease, border-color 0.2s ease' }}>
          <div className="container-pro h-full flex items-center justify-between">
            <div className="flex items-center gap-2 md:hidden">
              <div className="h-9 w-9 rounded-lg grid place-items-center font-semibold" style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>TK</div>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>TikTok Dashboard</span>
            </div>
            <div className="hidden md:block text-sm" style={{ color: 'var(--text-secondary)' }}>Welcome{user ? `, ${user.name}` : ''}</div>
            <div className="flex items-center gap-2">
              {user && <span className="hidden sm:block text-xs px-2 py-1 rounded-full border" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>{user.role}</span>}
              <button
                onClick={toggleTheme}
                className="btn btn-ghost p-2 min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center cursor-pointer"
                aria-label="Toggle theme"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                type="button"
              >
                {theme === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
              </button>
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
      className={({ isActive }) => {
        const base = 'block rounded-lg px-3 py-2 text-sm transition-colors';
        if (isActive) {
          return `${base} font-medium`;
        }
        return base;
      }}
      style={({ isActive }) => ({
        color: isActive ? '#2563eb' : 'var(--text-secondary)',
        backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
      } as React.CSSProperties)}
    >
      {label}
    </NavLink>
  );
}
