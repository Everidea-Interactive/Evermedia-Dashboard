import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { status, category, dateFrom, dateTo } = req.query as any;
  const where: any = {};
  if (status) where.status = status;
  if (category) {
    where.categories = { has: String(category) };
  }
  if (dateFrom || dateTo) {
    where.AND = [] as any[];
    if (dateFrom) where.AND.push({ startDate: { gte: new Date(String(dateFrom)) } });
    if (dateTo) where.AND.push({ endDate: { lte: new Date(String(dateTo)) } });
  }
  const campaigns = await prisma.campaign.findMany({ where, orderBy: { createdAt: 'desc' } });
  res.json(campaigns);
});

router.post('/', async (req, res) => {
  const { name, categories, startDate, endDate, status, description, accountIds } = req.body as any;
  if (!name || !categories || !Array.isArray(categories) || categories.length === 0 || !startDate || !endDate || !status) {
    return res.status(400).json({ error: 'Missing fields: name, categories (array), startDate, endDate, and status are required' });
  }
  const campaign = await prisma.campaign.create({
    data: {
      name,
      categories: categories,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      status,
      description,
      accounts: accountIds?.length ? { connect: accountIds.map((id: string) => ({ id })) } : undefined,
    },
  });
  res.status(201).json(campaign);
});

router.get('/:id', async (req, res) => {
  const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id }, include: { accounts: true } });
  if (!campaign) return res.status(404).json({ error: 'Not found' });
  res.json(campaign);
});

router.put('/:id', async (req, res) => {
  const { name, categories, startDate, endDate, status, description, accountIds } = req.body as any;
  try {
    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        name,
        ...(categories !== undefined ? { categories: Array.isArray(categories) ? categories : [] } : {}),
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status,
        description,
        ...(accountIds ? { accounts: { set: accountIds.map((id: string) => ({ id })) } } : {}),
      },
    });
    res.json(campaign);
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

router.get('/:id/kpis', async (req, res) => {
  const kpis = await prisma.kPI.findMany({ where: { campaignId: req.params.id } });
  res.json(kpis.map((k: any) => ({ ...k, remaining: k.target - k.actual })));
});

// Convenience: /api/campaigns/:id/posts with filters
router.get('/:id/posts', async (req, res) => {
  const id = req.params.id;
  const { dateFrom, dateTo, picTalentId, picEditorId, picPostingId, accountId, status, category } = req.query as any;
  const where: any = { campaignId: id };
  if (accountId) where.accountId = accountId;
  if (status) where.status = { contains: String(status), mode: 'insensitive' };
  if (category) where.contentCategory = { contains: String(category), mode: 'insensitive' };
  if (dateFrom) where.postDate = { ...(where.postDate || {}), gte: new Date(String(dateFrom)) };
  if (dateTo) where.postDate = { ...(where.postDate || {}), lte: new Date(String(dateTo)) };
  if (picTalentId) where.picTalentId = picTalentId;
  if (picEditorId) where.picEditorId = picEditorId;
  if (picPostingId) where.picPostingId = picPostingId;
  const posts = await prisma.post.findMany({
    where,
    orderBy: { postDate: 'desc' },
    include: { account: { select: { id: true, name: true } }, campaign: { select: { id: true, name: true } }, picTalent: { select: { id: true, name: true } }, picEditor: { select: { id: true, name: true } }, picPosting: { select: { id: true, name: true } } },
  });
  const mapped = posts.map((p: any) => {
    const views = p.totalView || 0, likes = p.totalLike || 0, comments = p.totalComment || 0, shares = p.totalShare || 0, saves = p.totalSaved || 0;
    const er = views === 0 ? 0 : (likes + comments + shares + saves) / views;
    return { ...p, engagementRate: Number(er.toFixed(4)) };
  });
  res.json(mapped);
});

router.delete('/:id/accounts/:accountId', requireAuth, async (req, res) => {
  const { id, accountId } = req.params;
  try {
    await prisma.campaign.update({
      where: { id },
      data: { accounts: { disconnect: { id: accountId } } },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
