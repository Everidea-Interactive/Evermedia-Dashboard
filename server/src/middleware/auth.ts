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

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
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
