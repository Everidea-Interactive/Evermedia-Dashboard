import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { api, setUnauthorizedHandler } from '../lib/api';
import { clearAllCache } from '../lib/cache';

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
  const [refreshToken, setRefreshToken] = useState<string | null>(() => localStorage.getItem('refreshToken'));
  const [expiresAt, setExpiresAt] = useState<number | null>(() => {
    const stored = localStorage.getItem('tokenExpiresAt');
    return stored ? Number(stored) : null;
  });
  const [user, setUser] = useState<User | null>(() => {
    const str = localStorage.getItem('user');
    return str ? JSON.parse(str) : null;
  });

  const logout = useCallback(() => {
    setToken(null);
    setRefreshToken(null);
    setExpiresAt(null);
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tokenExpiresAt');
    localStorage.removeItem('user');
    clearAllCache();
  }, []);

  const refreshSession = useCallback(async () => {
    if (!refreshToken) {
      logout();
      return false;
    }
    try {
      const res = await api('/auth/refresh', { method: 'POST', body: { refreshToken } });
      setToken(res.token);
      setRefreshToken(res.refreshToken);
      setExpiresAt(res.expiresAt || null);
      setUser(res.user);
      localStorage.setItem('token', res.token);
      localStorage.setItem('refreshToken', res.refreshToken);
      if (res.expiresAt) {
        localStorage.setItem('tokenExpiresAt', String(res.expiresAt));
      } else {
        localStorage.removeItem('tokenExpiresAt');
      }
      return true;
    } catch (error) {
      logout();
      return false;
    }
  }, [refreshToken, logout]);

  // Set up global 401 handler
  useEffect(() => {
    setUnauthorizedHandler(async () => {
      await refreshSession();
      // Redirect will happen via ProtectedRoute detecting no token after refresh failure
    });
    return () => setUnauthorizedHandler(null);
  }, [refreshSession]);

  // Keep access token alive shortly before expiry
  useEffect(() => {
    if (!token || !refreshToken || !expiresAt) return;
    const now = Math.floor(Date.now() / 1000);
    const secondsUntilRefresh = expiresAt - now - 60; // refresh 1 minute before expiry

    if (secondsUntilRefresh <= 0) {
      refreshSession();
      return;
    }

    const id = setTimeout(() => refreshSession(), secondsUntilRefresh * 1000);
    return () => clearTimeout(id);
  }, [token, refreshToken, expiresAt, refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api('/auth/login', { method: 'POST', body: { email, password } });
    clearAllCache();
    setToken(res.token);
    setRefreshToken(res.refreshToken);
    setExpiresAt(res.expiresAt || null);
    setUser(res.user);
    localStorage.setItem('token', res.token);
    localStorage.setItem('refreshToken', res.refreshToken);
    if (res.expiresAt) {
      localStorage.setItem('tokenExpiresAt', String(res.expiresAt));
    }
    localStorage.setItem('user', JSON.stringify(res.user));
  }, []);

  const value = useMemo(() => ({ user, token, login, logout }), [user, token, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
