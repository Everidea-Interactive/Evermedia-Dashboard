import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { campaignId, accountId } = req.query as any;
  const where: any = {};
  if (campaignId) where.campaignId = campaignId;
  if (accountId) where.accountId = accountId;
  const kpis = await prisma.kPI.findMany({ where });
  res.json(kpis.map((k: any) => ({ ...k, remaining: k.target - k.actual })));
});

router.post('/', async (req, res) => {
  const { campaignId, accountId, category, target, actual } = req.body as any;
  if (!campaignId || !category || target == null) return res.status(400).json({ error: 'Missing fields' });
  const kpi = await prisma.kPI.create({ data: { campaignId, accountId, category, target, actual: actual ?? 0 } });
  res.status(201).json({ ...kpi, remaining: kpi.target - kpi.actual });
});

router.put('/:id', async (req, res) => {
  const { target, actual } = req.body as any;
  try {
    const kpi = await prisma.kPI.update({ where: { id: req.params.id }, data: { target, actual } });
    res.json({ ...kpi, remaining: kpi.target - kpi.actual });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.kPI.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;
