import { Router } from 'express';
import { supabase, supabaseAuth } from '../supabase.js';
import { z } from 'zod';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    
    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: body.email,
      password: body.password,
    });

    if (authError || !authData.user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user role from database
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('id, email, name, role')
      .eq('id', authData.user.id)
      .single();

    if (userError) {
      console.error('Error fetching user from database:', userError);
      return res.status(401).json({ error: 'User not found', details: userError.message });
    }

    if (!user) {
      console.error(`User with id ${authData.user.id} not found in User table`);
      return res.status(401).json({ error: 'User not found. Please contact administrator to create your account.' });
    }

    res.json({
      token: authData.session?.access_token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Email and password required' });
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
