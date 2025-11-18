import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';
import { recalculateKPIs, recalculateCampaignKPIs } from '../utils/kpiRecalculation.js';

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

router.get('/all', async (req, res) => {
  const { campaignId, dateFrom, dateTo, picTalentId, picEditorId, picPostingId, accountId, status, category } = req.query as any;
  
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
  
  // Fetch related data
  const accountIds = [...new Set((posts || []).map((p: any) => p.accountId))];
  const picIds = [...new Set((posts || []).flatMap((p: any) => [p.picTalentId, p.picEditorId, p.picPostingId]).filter(Boolean))];
  const campaignIds = [...new Set((posts || []).map((p: any) => p.campaignId))];
  
  const { data: accounts } = await supabase.from('Account').select('id, name').in('id', accountIds);
  const { data: pics } = await supabase.from('PIC').select('id, name').in('id', picIds);
  const { data: campaigns } = await supabase.from('Campaign').select('id, name').in('id', campaignIds);
  
  const accountMap = new Map((accounts || []).map((a: any) => [a.id, a]));
  const picMap = new Map((pics || []).map((p: any) => [p.id, p]));
  const campaignMap = new Map((campaigns || []).map((c: any) => [c.id, c]));
  
  const mapped = (posts || []).map((p: any) => {
    const views = p.totalView || 0, likes = p.totalLike || 0, comments = p.totalComment || 0, shares = p.totalShare || 0, saves = p.totalSaved || 0;
    const er = views === 0 ? 0 : (likes + comments + shares + saves) / views;
    return {
      ...computeEngagement(p),
      account: accountMap.get(p.accountId) || null,
      campaign: campaignMap.get(p.campaignId) || null,
      picTalent: p.picTalentId ? picMap.get(p.picTalentId) || null : null,
      picEditor: p.picEditorId ? picMap.get(p.picEditorId) || null : null,
      picPosting: p.picPostingId ? picMap.get(p.picPostingId) || null : null,
    };
  });
  res.json(mapped);
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
  
  // Recalculate KPIs after post creation
  if (post.campaignId) {
    // Recalculate for the account
    if (post.accountId) {
      await recalculateKPIs(post.campaignId, post.accountId);
    }
    // Always recalculate campaign-level KPIs (where accountId is null)
    await recalculateCampaignKPIs(post.campaignId);
  }
  
  res.status(201).json(computeEngagement(post));
});

router.put('/:id', async (req, res) => {
  const data: any = { ...req.body };
  if (data.postDate) {
    const d = new Date(data.postDate);
    data.postDate = d.toISOString();
    data.postDay = d.toLocaleDateString('en-US', { weekday: 'long' });
  }
  
  // Get the post before update to know which campaign/account to update KPIs for
  const { data: oldPost } = await supabase
    .from('Post')
    .select('campaignId, accountId')
    .eq('id', req.params.id)
    .single();
  
  const { data: post, error } = await supabase
    .from('Post')
    .update(data)
    .eq('id', req.params.id)
    .select()
    .single();
  
  if (error || !post) return res.status(404).json({ error: 'Not found' });
  
  // Recalculate KPIs for the campaign and account after post update
  if (post.campaignId) {
    // Recalculate for the new account
    if (post.accountId) {
      await recalculateKPIs(post.campaignId, post.accountId);
    }
    
    // If accountId changed, also recalculate for the old account
    if (oldPost?.accountId && oldPost.accountId !== post.accountId) {
      await recalculateKPIs(oldPost.campaignId, oldPost.accountId);
    }
    
    // Always recalculate campaign-level KPIs (where accountId is null)
    await recalculateCampaignKPIs(post.campaignId);
  }
  
  res.json(computeEngagement(post));
});


router.delete('/:id', async (req, res) => {
  // Get the post before deletion to know which campaign/account to update KPIs for
  const { data: post } = await supabase
    .from('Post')
    .select('campaignId, accountId')
    .eq('id', req.params.id)
    .single();
  
  const { error } = await supabase.from('Post').delete().eq('id', req.params.id);
  if (error) return res.status(404).json({ error: 'Not found' });
  
  // Recalculate KPIs after post deletion
  if (post?.campaignId) {
    // Recalculate for the account
    if (post.accountId) {
      await recalculateKPIs(post.campaignId, post.accountId);
    }
    // Always recalculate campaign-level KPIs (where accountId is null)
    await recalculateCampaignKPIs(post.campaignId);
  }
  
  res.json({ ok: true });
});

export default router;
