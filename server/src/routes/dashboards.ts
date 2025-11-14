import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function engagementRate(sum: { views: number; likes: number; comments: number; shares: number; saves: number }) {
  const { views, likes, comments, shares, saves } = sum;
  return views === 0 ? 0 : Number(((likes + comments + shares + saves) / views).toFixed(4));
}

router.get('/campaigns/:id/dashboard/engagement', async (req, res) => {
  const campaignId = req.params.id;
  const posts = await prisma.post.findMany({ where: { campaignId } });
  const sum = posts.reduce(
    (acc: any, p: any) => {
      acc.views += p.totalView || 0;
      acc.likes += p.totalLike || 0;
      acc.comments += p.totalComment || 0;
      acc.shares += p.totalShare || 0;
      acc.saves += p.totalSaved || 0;
      return acc;
    },
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
  );
  res.json({ ...sum, engagementRate: engagementRate(sum) });
});

router.get('/campaigns/:id/dashboard/kpi', async (req, res) => {
  const campaignId = req.params.id;
  const { kpiCategory, accountId, crossbrandOnly } = req.query as any;

  const where: any = { campaignId };
  if (kpiCategory) where.category = kpiCategory;
  if (accountId) where.accountId = accountId;

  let kpis = await prisma.kPI.findMany({ where, include: { account: { include: { campaigns: { select: { id: true } } } } } });
  if (crossbrandOnly === 'true') {
    kpis = kpis.filter((k: any) => (k.account ? (k.account.campaigns.length >= 2) : false));
  }

  const data = kpis.map(k => ({
    id: k.id,
    campaignId: k.campaignId,
    accountId: k.accountId,
    category: k.category,
    target: k.target,
    actual: k.actual,
    remaining: k.target - k.actual,
  }));
  res.json(data);
});

export default router;
