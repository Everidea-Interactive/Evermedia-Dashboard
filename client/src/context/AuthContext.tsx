import { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { api, setUnauthorizedHandler } from '../lib/api';

type User = { id: string; name: string; email: string; role: 'ADMIN'|'CAMPAIGN_MANAGER'|'EDITOR'|'VIEWER' };

type AuthContextType = {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(() => {
    const str = localStorage.getItem('user');
    return str ? JSON.parse(str) : null;
  });

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  // Set up global 401 handler
  useEffect(() => {
    setUnauthorizedHandler(() => {
      logout();
      // Redirect will happen via ProtectedRoute detecting no token
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Verify token on mount
  useEffect(() => {
    if (token) {
      // Token validation happens via API calls, so we keep it simple
      // If token is invalid, API calls will fail and user will be logged out
    }
  }, [token]);

  const login = async (email: string, password: string) => {
    const res = await api('/auth/login', { method: 'POST', body: { email, password } });
    setToken(res.token);
    setUser(res.user);
    localStorage.setItem('token', res.token);
    localStorage.setItem('user', JSON.stringify(res.user));
  };

  const value = useMemo(() => ({ user, token, login, logout }), [user, token]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
