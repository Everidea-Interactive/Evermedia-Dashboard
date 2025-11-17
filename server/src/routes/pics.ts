import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { role, active } = req.query as any;
  const where: any = {};
  if (active === 'true') where.active = true;
  if (active === 'false') where.active = false;
  const pics = await prisma.pIC.findMany({
    where,
    include: { roles: { include: { roleType: true } } },
    orderBy: { name: 'asc' },
  });
  const filtered = role
    ? pics.filter((p: any) => p.roles.some((r: any) => r.roleType.name.toUpperCase() === String(role).toUpperCase()))
    : pics;
  res.json(filtered.map((p: any) => ({
    id: p.id,
    name: p.name,
    contact: p.contact,
    notes: p.notes,
    active: p.active,
    roles: p.roles.map((r: any) => r.roleType.name),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  })));
});

router.post('/', async (req, res) => {
  const { name, contact, notes, active, roles } = req.body as any;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const roleTypes = (roles || []) as string[];
  const pic = await prisma.pIC.create({
    data: {
      name,
      contact,
      notes,
      active: active ?? true,
      roles: roleTypes.length
        ? {
            create: roleTypes.map((roleName) => ({
              roleType: {
                connectOrCreate: {
                  where: { name: String(roleName).toUpperCase() },
                  create: { name: String(roleName).toUpperCase() },
                },
              },
            })),
          }
        : undefined,
    },
    include: { roles: { include: { roleType: true } } },
  });
  res.status(201).json({ ...pic, roles: pic.roles.map(r => r.roleType.name) });
});

router.put('/:id', async (req, res) => {
  const { name, contact, notes, active, roles } = req.body as any;
  try {
    const roleTypes = (roles || []) as string[];
    const pic = await prisma.pIC.update({
      where: { id: req.params.id },
        data: {
          name,
          contact,
          notes,
          active,
          ...(roles ? {
          roles: {
            deleteMany: {},
            create: roleTypes.map((roleName) => ({
              roleType: {
                connectOrCreate: {
                  where: { name: String(roleName).toUpperCase() },
                  create: { name: String(roleName).toUpperCase() },
                },
              },
            })),
          },
        } : {}),
      },
      include: { roles: { include: { roleType: true } } },
    });
    res.json({ ...pic, roles: pic.roles.map(r => r.roleType.name) });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.pIC.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
