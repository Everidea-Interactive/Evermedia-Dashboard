import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePermissions } from '../hooks/usePermissions';
import RequirePermission from '../components/RequirePermission';
import { useState } from 'react';
import Dialog from '../components/ui/Dialog';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { canManageUsers, canAddPost } = usePermissions();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMobileMenuOpen(false);
    setLogoutDialogOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)', transition: 'background-color 0.2s ease' }}>
      <header className="sticky top-0 z-50 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)', transition: 'background-color 0.2s ease, border-color 0.2s ease' }}>
        <div className="container-pro">
          {/* Main header bar */}
          <div className="h-16 flex items-center justify-between">
            {/* Logo and brand */}
            <Link
              to="/"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 rounded-lg px-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
            >
              <img src="/favicon.svg" alt="Evermedia Dashboard" className="h-9 w-9 rounded-lg" />
              <div className="hidden sm:block">
                <div className="font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>Evermedia Dashboard</div>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center gap-1">
              <NavLink
                to="/campaigns"
                className={({ isActive }) => {
                  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
                  return isActive
                    ? `${base} text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400`
                    : `${base} hover:bg-gray-100 dark:hover:bg-gray-800`;
                }}
                style={({ isActive }) => ({
                  color: isActive ? '#2563eb' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                } as React.CSSProperties)}
              >
                Campaigns
              </NavLink>
              <NavLink
                to="/daily"
                className={({ isActive }) => {
                  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
                  return isActive
                    ? `${base} text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400`
                    : `${base} hover:bg-gray-100 dark:hover:bg-gray-800`;
                }}
                style={({ isActive }) => ({
                  color: isActive ? '#2563eb' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                } as React.CSSProperties)}
              >
                Daily
              </NavLink>
              <NavLink
                to="/posts/all"
                className={({ isActive }) => {
                  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
                  return isActive
                    ? `${base} text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400`
                    : `${base} hover:bg-gray-100 dark:hover:bg-gray-800`;
                }}
                style={({ isActive }) => ({
                  color: isActive ? '#2563eb' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                } as React.CSSProperties)}
              >
                All Posts
              </NavLink>
              <NavLink
                to="/accounts"
                className={({ isActive }) => {
                  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
                  return isActive
                    ? `${base} text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400`
                    : `${base} hover:bg-gray-100 dark:hover:bg-gray-800`;
                }}
                style={({ isActive }) => ({
                  color: isActive ? '#2563eb' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                } as React.CSSProperties)}
              >
                Accounts
              </NavLink>
              <NavLink
                to="/pics"
                className={({ isActive }) => {
                  const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
                  return isActive
                    ? `${base} text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400`
                    : `${base} hover:bg-gray-100 dark:hover:bg-gray-800`;
                }}
                style={({ isActive }) => ({
                  color: isActive ? '#2563eb' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                } as React.CSSProperties)}
              >
                PICs
              </NavLink>
              {canManageUsers() && (
                <>
                  <NavLink
                    to="/users"
                    className={({ isActive }) => {
                      const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
                      return isActive
                        ? `${base} text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400`
                        : `${base} hover:bg-gray-100 dark:hover:bg-gray-800`;
                    }}
                    style={({ isActive }) => ({
                      color: isActive ? '#2563eb' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                    } as React.CSSProperties)}
                  >
                    Users
                  </NavLink>
                  <NavLink
                    to="/activity-logs"
                    className={({ isActive }) => {
                      const base = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
                      return isActive
                        ? `${base} text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400`
                        : `${base} hover:bg-gray-100 dark:hover:bg-gray-800`;
                    }}
                    style={({ isActive }) => ({
                      color: isActive ? '#2563eb' : 'var(--text-secondary)',
                      backgroundColor: isActive ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
                    } as React.CSSProperties)}
                  >
                    Activity Logs
                  </NavLink>
                </>
              )}
              <RequirePermission permission={canAddPost}>
                <Link
                  to="/posts/new"
                  className="btn btn-primary text-sm ml-2"
                >
                  Add new Post
                </Link>
              </RequirePermission>
            </nav>

            {/* Right side actions */}
            <div className="flex items-center gap-2">
              {/* Light toggle button */}
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
              {/* Account info - only show on desktop (lg+) */}
              <div className="hidden lg:flex items-center gap-2">
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>Welcome{user ? `, ${user.name}` : ''}</div>
                {user && <span className="text-xs px-2 py-1 rounded-full border" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-color)' }}>{user.role}</span>}
              </div>
              {/* Logout icon button - only show on desktop (lg+) where hamburger menu is hidden */}
              <div className="hidden lg:block">
                <button
                  className="btn btn-ghost p-2 min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center"
                  onClick={() => setLogoutDialogOpen(true)}
                  aria-label="Logout"
                  title="Logout"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
              
              {/* Mobile menu button - only show on mobile/tablet (< lg) */}
              <div className="lg:hidden">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="btn btn-ghost p-2 min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center"
                  aria-label="Toggle menu"
                  type="button"
                >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
                </button>
              </div>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t py-4" style={{ borderColor: 'var(--border-color)' }}>
              {/* Account information panel at the top */}
              <div className="px-4 py-2 pb-4 border-b mb-4 flex items-center justify-between" style={{ borderColor: 'var(--border-color)' }}>
                <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {user && <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</div>}
                  {user && <div className="text-xs mt-1">{user.role}</div>}
                </div>
                <button
                  className="btn btn-ghost p-2 min-w-[2.5rem] min-h-[2.5rem] flex items-center justify-center"
                  onClick={() => setLogoutDialogOpen(true)}
                  aria-label="Logout"
                  title="Logout"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col space-y-2">
                <MobileNavLink
                  to="/campaigns"
                  label="Campaigns"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <MobileNavLink
                  to="/daily"
                  label="Daily"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <MobileNavLink
                  to="/posts/all"
                  label="All Posts"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <MobileNavLink
                  to="/accounts"
                  label="Accounts"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <MobileNavLink
                  to="/pics"
                  label="PICs"
                  onClick={() => setMobileMenuOpen(false)}
                />
                {canManageUsers() && (
                  <>
                    <MobileNavLink
                      to="/users"
                      label="Users"
                      onClick={() => setMobileMenuOpen(false)}
                    />
                    <MobileNavLink
                      to="/activity-logs"
                      label="Activity Logs"
                      onClick={() => setMobileMenuOpen(false)}
                    />
                  </>
                )}
                <RequirePermission permission={canAddPost}>
                  <Link
                    to="/posts/new"
                    className="btn btn-primary w-full text-center text-sm mt-2"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    Add new Post
                  </Link>
                </RequirePermission>
              </nav>
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">
        <div className="container-pro py-6">
          {children}
        </div>
      </main>

      {/* Logout Confirmation Dialog */}
      <Dialog
        open={logoutDialogOpen}
        onClose={() => setLogoutDialogOpen(false)}
        title="Confirm Logout"
        footer={
          <>
            <button
              className="btn btn-outline"
              onClick={() => setLogoutDialogOpen(false)}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={handleLogout}
            >
              Logout
            </button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)' }}>
          Are you sure you want to logout? You will need to sign in again to access your account.
        </p>
      </Dialog>
    </div>
  );
}

function MobileNavLink({ to, label, onClick }: { to: string; label: string; onClick: () => void }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) => {
        const base = 'block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors';
        return isActive
          ? `${base} text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400`
          : `${base} hover:bg-gray-100 dark:hover:bg-gray-800`;
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
