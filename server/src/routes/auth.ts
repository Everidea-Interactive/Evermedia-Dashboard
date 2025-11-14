import { Router } from 'express';
import { prisma } from '../prisma.js';
import { comparePassword } from '../utils/password.js';
import { signJwt } from '../utils/jwt.js';
import { z } from 'zod';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: body.email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = await comparePassword(body.password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = signJwt({ id: user.id, email: user.email, role: user.role, name: user.name });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err: any) {
    if (err?.issues) return res.status(400).json({ error: 'Email and password required' });
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
