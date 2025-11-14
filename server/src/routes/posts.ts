import { Router } from 'express';
import { prisma } from '../prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function computeEngagement(p: any) {
  const views = p.totalView || 0;
  const likes = p.totalLike || 0;
  const comments = p.totalComment || 0;
  const shares = p.totalShare || 0;
  const saves = p.totalSaved || 0;
  const rate = views === 0 ? 0 : (likes + comments + shares + saves) / views;
  return { ...p, engagementRate: Number(rate.toFixed(4)) };
}

router.get('/', async (req, res) => {
  const { campaignId, accountId, status, category, dateFrom, dateTo, picTalentId, picEditorId, picPostingId } = req.query as any;
  const where: any = {};
  if (campaignId) where.campaignId = campaignId;
  if (accountId) where.accountId = accountId;
  if (status) where.status = { contains: String(status), mode: 'insensitive' };
  if (category) where.contentCategory = { contains: String(category), mode: 'insensitive' };
  if (dateFrom) where.postDate = { ...(where.postDate || {}), gte: new Date(String(dateFrom)) };
  if (dateTo) where.postDate = { ...(where.postDate || {}), lte: new Date(String(dateTo)) };
  if (picTalentId) where.picTalentId = picTalentId;
  if (picEditorId) where.picEditorId = picEditorId;
  if (picPostingId) where.picPostingId = picPostingId;
  const posts = await prisma.post.findMany({ where, orderBy: { postDate: 'desc' } });
  res.json(posts.map(computeEngagement));
});

router.get('/campaign/:id', async (req, res) => {
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
  const posts = await prisma.post.findMany({ where, orderBy: { postDate: 'desc' } });
  res.json(posts.map(computeEngagement));
});

router.post('/', async (req, res) => {
  const {
    campaignId,
    accountId,
    postDate,
    picTalentId,
    picEditorId,
    picPostingId,
    contentCategory,
    adsOnMusic,
    yellowCart,
    postTitle,
    contentType,
    status,
    contentLink,
    totalView,
    totalLike,
    totalComment,
    totalShare,
    totalSaved,
  } = req.body as any;
  if (!campaignId || !accountId || !postDate || !postTitle) return res.status(400).json({ error: 'Missing fields' });
  const d = new Date(postDate);
  const postDay = d.toLocaleDateString('en-US', { weekday: 'long' });
  const post = await prisma.post.create({
    data: {
      campaignId,
      accountId,
      postDate: d,
      postDay,
      picTalentId,
      picEditorId,
      picPostingId,
      contentCategory,
      adsOnMusic: !!adsOnMusic,
      yellowCart: !!yellowCart,
      postTitle,
      contentType,
      status,
      contentLink,
      totalView: totalView ?? 0,
      totalLike: totalLike ?? 0,
      totalComment: totalComment ?? 0,
      totalShare: totalShare ?? 0,
      totalSaved: totalSaved ?? 0,
    },
  });
  res.status(201).json(computeEngagement(post));
});

router.put('/:id', async (req, res) => {
  const data: any = { ...req.body };
  if (data.postDate) {
    const d = new Date(data.postDate);
    data.postDate = d;
    data.postDay = d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  try {
    const post = await prisma.post.update({ where: { id: req.params.id }, data });
    res.json(computeEngagement(post));
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.post.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    res.status(404).json({ error: 'Not found' });
  }
});

export default router;

