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
    include: { 
      campaigns: { select: { id: true, name: true, categories: true } },
      _count: { select: { posts: true, kpis: true } }
    },
    orderBy: { createdAt: 'desc' },
  });
  let result = accounts.map((a: any) => withCrossbrand({
    id: a.id,
    name: a.name,
    tiktokHandle: a.tiktokHandle,
    accountType: a.accountType,
    brand: a.brand,
    notes: a.notes,
    campaigns: a.campaigns,
    postCount: a._count.posts,
    kpiCount: a._count.kpis,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  }, a.campaigns.length));

  if (crossbrand === 'true') result = result.filter((a: any) => a.isCrossbrand);
  if (crossbrand === 'false') result = result.filter((a: any) => !a.isCrossbrand);
  res.json(result);
});

router.post('/', async (req, res) => {
  const { name, tiktokHandle, accountType, brand, notes, campaignIds } = req.body;
  if (!name || !accountType) return res.status(400).json({ error: 'Missing fields' });
  const account = await prisma.account.create({
    data: {
      name,
      tiktokHandle,
      accountType,
      brand,
      notes,
      campaigns: campaignIds?.length ? { connect: campaignIds.map((id: string) => ({ id })) } : undefined,
    },
    include: { campaigns: { select: { id: true, name: true, category: true } } },
  });
  const result = withCrossbrand(account, account.campaigns.length);
  res.status(201).json(result);
});

router.get('/:id', async (req, res) => {
  const account = await prisma.account.findUnique({
    where: { id: req.params.id },
    include: { campaigns: { select: { id: true, name: true, category: true } } },
  });
  if (!account) return res.status(404).json({ error: 'Not found' });
  const a = withCrossbrand(account, account.campaigns.length);
  res.json(a);
});

router.put('/:id', async (req, res) => {
  const { name, tiktokHandle, accountType, brand, notes, campaignIds } = req.body;
  try {
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data: {
        name,
        tiktokHandle,
        accountType,
        brand,
        notes,
        ...(campaignIds !== undefined ? {
          campaigns: {
            set: campaignIds?.length ? campaignIds.map((id: string) => ({ id })) : [],
          },
        } : {}),
      },
      include: { campaigns: { select: { id: true, name: true, category: true } } },
    });
    const result = withCrossbrand(account, account.campaigns.length);
    res.json(result);
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    // Check if account has posts
    const postCount = await prisma.post.count({ where: { accountId: req.params.id } });
    if (postCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete account: This account has ${postCount} post(s) associated with it. Please delete or reassign the posts first.` 
      });
    }

    // Check if account has KPIs
    const kpiCount = await prisma.kPI.count({ where: { accountId: req.params.id } });
    if (kpiCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete account: This account has ${kpiCount} KPI(s) associated with it. Please delete the KPIs first.` 
      });
    }

    await prisma.account.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e: any) {
    if (e.code === 'P2025') {
      return res.status(404).json({ error: 'Account not found' });
    }
    res.status(500).json({ error: e.message || 'Failed to delete account' });
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
