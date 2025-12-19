import { Request, Response, NextFunction } from 'express';
import { supabase, supabaseAuth } from '../supabase.js';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'ADMIN' | 'CAMPAIGN_MANAGER' | 'EDITOR' | 'VIEWER';
    name?: string;
  };
}

type AuthCacheEntry = {
  user: AuthRequest['user'];
  expiresAt: number;
};

const AUTH_CACHE_TTL_MS = 5 * 60 * 1000;
const authCache = new Map<string, AuthCacheEntry>();

function decodeJwtPayload(token: string): { exp?: number } | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + (4 - (base64.length % 4 || 4)), '=');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function getCachedUser(token: string): AuthCacheEntry | null {
  const entry = authCache.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    authCache.delete(token);
    return null;
  }
  return entry;
}

function setCachedUser(token: string, user: AuthRequest['user']) {
  const payload = decodeJwtPayload(token);
  const tokenExpiryMs = payload?.exp ? payload.exp * 1000 : null;
  const expiresAt = tokenExpiryMs
    ? Math.min(tokenExpiryMs, Date.now() + AUTH_CACHE_TTL_MS)
    : Date.now() + AUTH_CACHE_TTL_MS;
  authCache.set(token, { user, expiresAt });
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const cached = getCachedUser(token);
  if (cached?.user) {
    req.user = cached.user;
    return next();
  }
  
  try {
    // Verify token with Supabase
    const { data: { user: authUser }, error: authError } = await supabaseAuth.auth.getUser(token);
    if (authError || !authUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user role from database
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('id, email, name, role')
      .eq('id', authUser.id)
      .single();

    if (userError) {
      console.error('Error fetching user from database:', userError);
      return res.status(401).json({ error: 'User not found', details: userError.message });
    }

    if (!user) {
      console.error(`User with id ${authUser.id} not found in User table`);
      return res.status(401).json({ error: 'User not found. Please contact administrator.' });
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };
    setCachedUser(token, req.user);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRoles(...roles: Array<'ADMIN' | 'CAMPAIGN_MANAGER' | 'EDITOR' | 'VIEWER'>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}
