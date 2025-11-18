import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { status, category, dateFrom, dateTo } = req.query as any;
  let query = supabase.from('Campaign').select('*').order('createdAt', { ascending: false });
  
  if (status) query = query.eq('status', status);
  if (category) query = query.contains('categories', [String(category)]);
  if (dateFrom) query = query.gte('startDate', String(dateFrom));
  if (dateTo) query = query.lte('endDate', String(dateTo));
  
  const { data: campaigns, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(campaigns || []);
});

router.post('/', async (req, res) => {
  const { name, categories, startDate, endDate, status, description, accountIds } = req.body as any;
  if (!name || !categories || !Array.isArray(categories) || categories.length === 0 || !startDate || !endDate || !status) {
    return res.status(400).json({ error: 'Missing fields: name, categories (array), startDate, endDate, and status are required' });
  }
  
  const { data: campaign, error } = await supabase
    .from('Campaign')
    .insert({
      name,
      categories,
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      status,
      description,
    })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  
  // Link accounts if provided
  if (accountIds?.length && campaign) {
    const links = accountIds.map((accountId: string) => ({
      A: campaign.id,
      B: accountId,
    }));
    await supabase.from('_CampaignToAccount').insert(links);
  }
  
  res.status(201).json(campaign);
});

router.get('/:id', async (req, res) => {
  const { data: campaign, error } = await supabase
    .from('Campaign')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  if (error || !campaign) return res.status(404).json({ error: 'Not found' });
  
  // Get linked accounts
  const { data: accountLinks } = await supabase
    .from('_CampaignToAccount')
    .select('B')
    .eq('A', campaign.id);
  
  const accountIds = accountLinks?.map((link: any) => link.B) || [];
  const { data: accounts } = await supabase
    .from('Account')
    .select('*')
    .in('id', accountIds);
  
  res.json({ ...campaign, accounts: accounts || [] });
});

router.put('/:id', async (req, res) => {
  const { name, categories, startDate, endDate, status, description, accountIds } = req.body as any;
  
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (categories !== undefined) updateData.categories = Array.isArray(categories) ? categories : [];
  if (startDate) updateData.startDate = new Date(startDate).toISOString();
  if (endDate) updateData.endDate = new Date(endDate).toISOString();
  if (status !== undefined) updateData.status = status;
  if (description !== undefined) updateData.description = description;
  
  const { data: campaign, error } = await supabase
    .from('Campaign')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();
  
  if (error || !campaign) return res.status(404).json({ error: 'Not found' });
  
  // Update account links if provided
  if (accountIds !== undefined) {
    await supabase.from('_CampaignToAccount').delete().eq('A', req.params.id);
    if (accountIds.length > 0) {
      const links = accountIds.map((accountId: string) => ({
        A: req.params.id,
        B: accountId,
      }));
      await supabase.from('_CampaignToAccount').insert(links);
    }
  }
  
  res.json(campaign);
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('Campaign').delete().eq('id', req.params.id);
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.get('/:id/kpis', async (req, res) => {
  const { data: kpis, error } = await supabase
    .from('KPI')
    .select('*')
    .eq('campaignId', req.params.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json((kpis || []).map((k: any) => ({ ...k, remaining: k.target - k.actual })));
});

// Convenience: /api/campaigns/:id/posts with filters
router.get('/:id/posts', async (req, res) => {
  const id = req.params.id;
  const { dateFrom, dateTo, picTalentId, picEditorId, picPostingId, accountId, status, category } = req.query as any;
  
  let query = supabase.from('Post').select('*').eq('campaignId', id);
  if (accountId) query = query.eq('accountId', accountId);
  if (status) query = query.ilike('status', `%${String(status)}%`);
  if (category) query = query.ilike('contentCategory', `%${String(category)}%`);
  if (dateFrom) query = query.gte('postDate', String(dateFrom));
  if (dateTo) query = query.lte('postDate', String(dateTo));
  if (picTalentId) query = query.eq('picTalentId', picTalentId);
  if (picEditorId) query = query.eq('picEditorId', picEditorId);
  if (picPostingId) query = query.eq('picPostingId', picPostingId);
  
  const { data: posts, error } = await query.order('postDate', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  
  // Fetch related data
  const accountIds = [...new Set((posts || []).map((p: any) => p.accountId))];
  const picIds = [...new Set((posts || []).flatMap((p: any) => [p.picTalentId, p.picEditorId, p.picPostingId]).filter(Boolean))];
  
  const { data: accounts } = await supabase.from('Account').select('id, name').in('id', accountIds);
  const { data: pics } = await supabase.from('PIC').select('id, name').in('id', picIds);
  const { data: campaign } = await supabase.from('Campaign').select('id, name').eq('id', id).single();
  
  const accountMap = new Map((accounts || []).map((a: any) => [a.id, a]));
  const picMap = new Map((pics || []).map((p: any) => [p.id, p]));
  
  const mapped = (posts || []).map((p: any) => {
    const views = p.totalView || 0, likes = p.totalLike || 0, comments = p.totalComment || 0, shares = p.totalShare || 0, saves = p.totalSaved || 0;
    const er = views === 0 ? 0 : (likes + comments + shares + saves) / views;
    return {
      ...p,
      engagementRate: Number(er.toFixed(4)),
      account: accountMap.get(p.accountId) || null,
      campaign: campaign || null,
      picTalent: p.picTalentId ? picMap.get(p.picTalentId) || null : null,
      picEditor: p.picEditorId ? picMap.get(p.picEditorId) || null : null,
      picPosting: p.picPostingId ? picMap.get(p.picPostingId) || null : null,
    };
  });
  res.json(mapped);
});

router.delete('/:id/accounts/:accountId', async (req, res) => {
  const { id, accountId } = req.params;
  const { error } = await supabase
    .from('_CampaignToAccount')
    .delete()
    .eq('A', id)
    .eq('B', accountId);
  
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
