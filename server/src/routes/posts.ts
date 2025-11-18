import { Router } from 'express';
import { supabase } from '../supabase.js';
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
  let query = supabase.from('Post').select('*').order('postDate', { ascending: false });
  
  if (campaignId) query = query.eq('campaignId', campaignId);
  if (accountId) query = query.eq('accountId', accountId);
  if (status) query = query.ilike('status', `%${String(status)}%`);
  if (category) query = query.ilike('contentCategory', `%${String(category)}%`);
  if (dateFrom) query = query.gte('postDate', String(dateFrom));
  if (dateTo) query = query.lte('postDate', String(dateTo));
  if (picTalentId) query = query.eq('picTalentId', picTalentId);
  if (picEditorId) query = query.eq('picEditorId', picEditorId);
  if (picPostingId) query = query.eq('picPostingId', picPostingId);
  
  const { data: posts, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json((posts || []).map(computeEngagement));
});

router.get('/campaign/:id', async (req, res) => {
  const id = req.params.id;
  const { dateFrom, dateTo, picTalentId, picEditorId, picPostingId, accountId, status, category } = req.query as any;
  
  let query = supabase.from('Post').select('*').eq('campaignId', id).order('postDate', { ascending: false });
  if (accountId) query = query.eq('accountId', accountId);
  if (status) query = query.ilike('status', `%${String(status)}%`);
  if (category) query = query.ilike('contentCategory', `%${String(category)}%`);
  if (dateFrom) query = query.gte('postDate', String(dateFrom));
  if (dateTo) query = query.lte('postDate', String(dateTo));
  if (picTalentId) query = query.eq('picTalentId', picTalentId);
  if (picEditorId) query = query.eq('picEditorId', picEditorId);
  if (picPostingId) query = query.eq('picPostingId', picPostingId);
  
  const { data: posts, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json((posts || []).map(computeEngagement));
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
  
  const { data: post, error } = await supabase
    .from('Post')
    .insert({
      campaignId,
      accountId,
      postDate: d.toISOString(),
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
    })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(computeEngagement(post));
});

router.put('/:id', async (req, res) => {
  const data: any = { ...req.body };
  if (data.postDate) {
    const d = new Date(data.postDate);
    data.postDate = d.toISOString();
    data.postDay = d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  const { data: post, error } = await supabase
    .from('Post')
    .update(data)
    .eq('id', req.params.id)
    .select()
    .single();
  
  if (error || !post) return res.status(404).json({ error: 'Not found' });
  res.json(computeEngagement(post));
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('Post').delete().eq('id', req.params.id);
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
