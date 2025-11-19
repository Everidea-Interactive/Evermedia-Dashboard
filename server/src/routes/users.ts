import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth.js';
import { logActivity, getEntityName } from '../utils/activityLog.js';

const router = Router();

router.use(requireAuth, requireRoles('ADMIN'));

router.get('/', async (_req, res) => {
  const { data: users, error } = await supabase
    .from('User')
    .select('id, name, email, role, createdAt')
    .order('createdAt', { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  res.json(users || []);
});

router.post('/', async (req: AuthRequest, res) => {
  const { name, email, password, role } = req.body as { name: string; email: string; password: string; role: any };
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  
  // Create user in Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  
  if (authError || !authData.user) {
    return res.status(500).json({ error: authError?.message || 'Failed to create user' });
  }
  
  // Create user record in database
  const { data: user, error: userError } = await supabase
    .from('User')
    .insert({ id: authData.user.id, name, email, role })
    .select('id, name, email, role')
    .single();
  
  if (userError) {
    // Clean up auth user if database insert fails
    await supabase.auth.admin.deleteUser(authData.user.id);
    return res.status(500).json({ error: userError.message });
  }
  
  // Log activity
  await logActivity(req, {
    action: 'CREATE',
    entityType: 'User',
    entityId: user.id,
    entityName: getEntityName('User', user),
    newValues: user,
  });
  
  res.status(201).json(user);
});

router.get('/:id', async (req, res) => {
  const { data: user, error } = await supabase
    .from('User')
    .select('id, name, email, role')
    .eq('id', req.params.id)
    .single();
  
  if (error || !user) return res.status(404).json({ error: 'Not found' });
  res.json(user);
});

router.put('/:id', async (req: AuthRequest, res) => {
  const { name, email, password, role } = req.body as { name?: string; email?: string; password?: string; role?: any };
  
  // Get old user data for logging
  const { data: oldUser } = await supabase
    .from('User')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (role !== undefined) updateData.role = role;
  
  // Update password in Supabase Auth if provided
  if (password) {
    const { error: passwordError } = await supabase.auth.admin.updateUserById(req.params.id, {
      password,
    });
    if (passwordError) {
      return res.status(500).json({ error: passwordError.message });
    }
  }
  
  // Update user record in database
  const { data: user, error: userError } = await supabase
    .from('User')
    .update(updateData)
    .eq('id', req.params.id)
    .select('id, name, email, role')
    .single();
  
  if (userError || !user) return res.status(404).json({ error: 'Not found' });
  
  // Log activity
  await logActivity(req, {
    action: 'UPDATE',
    entityType: 'User',
    entityId: user.id,
    entityName: getEntityName('User', user),
    oldValues: oldUser,
    newValues: user,
  });
  
  res.json(user);
});

router.delete('/:id', async (req: AuthRequest, res) => {
  // Get user data for logging before deletion
  const { data: user } = await supabase
    .from('User')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  // Delete from Supabase Auth
  const { error: authError } = await supabase.auth.admin.deleteUser(req.params.id);
  if (authError) {
    return res.status(500).json({ error: authError.message });
  }
  
  // Delete from database
  const { error } = await supabase.from('User').delete().eq('id', req.params.id);
  if (error) return res.status(404).json({ error: 'Not found' });
  
  // Log activity
  if (user) {
    await logActivity(req, {
      action: 'DELETE',
      entityType: 'User',
      entityId: req.params.id,
      entityName: getEntityName('User', user),
      oldValues: user,
    });
  }
  
  res.json({ ok: true });
});

export default router;
