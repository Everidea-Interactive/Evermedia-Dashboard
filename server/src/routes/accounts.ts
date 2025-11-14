import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

function withCrossbrand(account: any, campaignCount: number) {
  return { ...account, isCrossbrand: campaignCount >= 2 };
}

router.get('/', async (req, res) => {
  const { search, accountType, crossbrand } = req.query as any;
  const where: any = {};
  if (accountType) where.accountType = accountType;
  if (search) {
    where.OR = [
      { name: { contains: String(search), mode: 'insensitive' } },
      { tiktokHandle: { contains: String(search), mode: 'insensitive' } }
    ];
  }
  const accounts = await prisma.account.findMany({
    where,
    include: { campaigns: { select: { id: true } } },
    orderBy: { createdAt: 'desc' },
  });
  let result = accounts.map((a: any) => withCrossbrand({
    id: a.id,
    name: a.name,
    tiktokHandle: a.tiktokHandle,
    accountType: a.accountType,
    brand: a.brand,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }, a.campaigns.length));

  if (crossbrand === 'true') result = result.filter((a: any) => a.isCrossbrand);
  if (crossbrand === 'false') result = result.filter((a: any) => !a.isCrossbrand);
  res.json(result);
});

router.post('/', async (req, res) => {
  const { name, tiktokHandle, accountType, brand, notes } = req.body;
  if (!name || !accountType) return res.status(400).json({ error: 'Missing fields' });
  const account = await prisma.account.create({ data: { name, tiktokHandle, accountType, brand, notes } });
  res.status(201).json(account);
});

router.get('/:id', async (req, res) => {
  const account = await prisma.account.findUnique({
    where: { id: req.params.id },
    include: { campaigns: { select: { id: true } } },
  });
  if (!account) return res.status(404).json({ error: 'Not found' });
  const a = withCrossbrand(account, account.campaigns.length);
  res.json(a);
});

router.put('/:id', async (req, res) => {
  const { name, tiktokHandle, accountType, brand, notes } = req.body;
  try {
    const account = await prisma.account.update({ where: { id: req.params.id }, data: { name, tiktokHandle, accountType, brand, notes } });
    res.json(account);
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.account.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

router.get('/:id/campaigns', async (req, res) => {
  const account = await prisma.account.findUnique({
    where: { id: req.params.id },
    include: { campaigns: true },
  });
  if (!account) return res.status(404).json({ error: 'Not found' });
    res.json(account.campaigns);
  });

export default router;
