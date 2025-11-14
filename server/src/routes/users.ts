import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';
import { hashPassword } from '../utils/password.js';

const router = Router();

router.use(requireAuth, requireRoles('ADMIN'));

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(users.map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt })));
});

router.post('/', async (req, res) => {
  const { name, email, password, role } = req.body as { name: string; email: string; password: string; role: any };
  if (!name || !email || !password || !role) return res.status(400).json({ error: 'Missing fields' });
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { name, email, passwordHash, role } });
  res.status(201).json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

router.get('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

router.put('/:id', async (req, res) => {
  const { name, email, password, role } = req.body as { name?: string; email?: string; password?: string; role?: any };
  const data: any = {};
  if (name) data.name = name;
  if (email) data.email = email;
  if (password) data.passwordHash = await hashPassword(password);
  if (role) data.role = role;
  try {
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
