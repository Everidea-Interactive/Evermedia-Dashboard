import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

function withCrossbrand(account: any, campaignCount: number) {
  return { ...account, isCrossbrand: campaignCount >= 2 };
}

router.get('/', async (req, res) => {
  const { search, accountType, crossbrand } = req.query as any;
  let query = supabase.from('Account').select('*').order('createdAt', { ascending: false });
  
  if (accountType) query = query.eq('accountType', accountType);
  if (search) {
    query = query.or(`name.ilike.%${String(search)}%,tiktokHandle.ilike.%${String(search)}%`);
  }
  
  const { data: accounts, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  
  // Get campaign counts and post/kpi counts for each account
  const accountIds = (accounts || []).map((a: any) => a.id);
  
  const { data: campaignLinks } = await supabase
    .from('_CampaignToAccount')
    .select('B')
    .in('B', accountIds);
  
  const { data: posts } = await supabase
    .from('Post')
    .select('accountId')
    .in('accountId', accountIds);
  
  const { data: kpis } = await supabase
    .from('KPI')
    .select('accountId')
    .in('accountId', accountIds);
  
  const campaignCounts = new Map<string, number>();
  (campaignLinks || []).forEach((link: any) => {
    campaignCounts.set(link.B, (campaignCounts.get(link.B) || 0) + 1);
  });
  
  const postCounts = new Map<string, number>();
  (posts || []).forEach((p: any) => {
    postCounts.set(p.accountId, (postCounts.get(p.accountId) || 0) + 1);
  });
  
  const kpiCounts = new Map<string, number>();
  (kpis || []).forEach((k: any) => {
    if (k.accountId) {
      kpiCounts.set(k.accountId, (kpiCounts.get(k.accountId) || 0) + 1);
    }
  });
  
  // Get campaigns for each account
  const { data: allCampaignLinks } = await supabase
    .from('_CampaignToAccount')
    .select('A, B');
  
  const accountCampaignMap = new Map<string, string[]>();
  (allCampaignLinks || []).forEach((link: any) => {
    if (!accountCampaignMap.has(link.B)) {
      accountCampaignMap.set(link.B, []);
    }
    accountCampaignMap.get(link.B)!.push(link.A);
  });
  
  const { data: allCampaigns } = await supabase
    .from('Campaign')
    .select('id, name, categories');
  
  const campaignMap = new Map((allCampaigns || []).map((c: any) => [c.id, c]));
  
  let result = (accounts || []).map((a: any) => {
    const campaignIds = accountCampaignMap.get(a.id) || [];
    const campaigns = campaignIds.map((id: string) => campaignMap.get(id)).filter(Boolean);
    return withCrossbrand({
      id: a.id,
      name: a.name,
      tiktokHandle: a.tiktokHandle,
      accountType: a.accountType,
      brand: a.brand,
      notes: a.notes,
      campaigns,
      postCount: postCounts.get(a.id) || 0,
      kpiCount: kpiCounts.get(a.id) || 0,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }, campaigns.length);
  });

  if (crossbrand === 'true') result = result.filter((a: any) => a.isCrossbrand);
  if (crossbrand === 'false') result = result.filter((a: any) => !a.isCrossbrand);
  res.json(result);
});

router.post('/', async (req, res) => {
  const { name, tiktokHandle, accountType, brand, notes, campaignIds } = req.body;
  if (!name || !accountType) return res.status(400).json({ error: 'Missing fields' });
  
  const { data: account, error } = await supabase
    .from('Account')
    .insert({ name, tiktokHandle, accountType, brand, notes })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  
  // Link campaigns if provided
  if (campaignIds?.length && account) {
    const links = campaignIds.map((campaignId: string) => ({
      A: campaignId,
      B: account.id,
    }));
    await supabase.from('_CampaignToAccount').insert(links);
  }
  
  // Get campaigns for response
  const { data: campaignLinks } = await supabase
    .from('_CampaignToAccount')
    .select('A')
    .eq('B', account.id);
  
  const campaignIdsFromDb = campaignLinks?.map((link: any) => link.A) || [];
  const { data: campaigns } = await supabase
    .from('Campaign')
    .select('id, name, categories')
    .in('id', campaignIdsFromDb);
  
  const result = withCrossbrand({ ...account, campaigns: campaigns || [] }, campaigns?.length || 0);
  res.status(201).json(result);
});

router.get('/:id', async (req, res) => {
  const { data: account, error } = await supabase
    .from('Account')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  if (error || !account) return res.status(404).json({ error: 'Not found' });
  
  const { data: campaignLinks } = await supabase
    .from('_CampaignToAccount')
    .select('A')
    .eq('B', account.id);
  
  const campaignIds = campaignLinks?.map((link: any) => link.A) || [];
  const { data: campaigns } = await supabase
    .from('Campaign')
    .select('id, name, categories')
    .in('id', campaignIds);
  
  const a = withCrossbrand({ ...account, campaigns: campaigns || [] }, campaigns?.length || 0);
  res.json(a);
});

router.put('/:id', async (req, res) => {
  const { name, tiktokHandle, accountType, brand, notes, campaignIds } = req.body;
  
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (tiktokHandle !== undefined) updateData.tiktokHandle = tiktokHandle;
  if (accountType !== undefined) updateData.accountType = accountType;
  if (brand !== undefined) updateData.brand = brand;
  if (notes !== undefined) updateData.notes = notes;
  
  const { data: account, error } = await supabase
    .from('Account')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();
  
  if (error || !account) return res.status(404).json({ error: 'Not found' });
  
  // Update campaign links if provided
  if (campaignIds !== undefined) {
    await supabase.from('_CampaignToAccount').delete().eq('B', req.params.id);
    if (campaignIds.length > 0) {
      const links = campaignIds.map((campaignId: string) => ({
        A: campaignId,
        B: req.params.id,
      }));
      await supabase.from('_CampaignToAccount').insert(links);
    }
  }
  
  // Get campaigns for response
  const { data: campaignLinks } = await supabase
    .from('_CampaignToAccount')
    .select('A')
    .eq('B', account.id);
  
  const campaignIdsFromDb = campaignLinks?.map((link: any) => link.A) || [];
  const { data: campaigns } = await supabase
    .from('Campaign')
    .select('id, name, categories')
    .in('id', campaignIdsFromDb);
  
  const result = withCrossbrand({ ...account, campaigns: campaigns || [] }, campaigns?.length || 0);
  res.json(result);
});

router.delete('/:id', async (req, res) => {
  try {
    // Check if account has posts
    const { count: postCount } = await supabase
      .from('Post')
      .select('*', { count: 'exact', head: true })
      .eq('accountId', req.params.id);
    
    if (postCount && postCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete account: This account has ${postCount} post(s) associated with it. Please delete or reassign the posts first.` 
      });
    }

    // Check if account has KPIs
    const { count: kpiCount } = await supabase
      .from('KPI')
      .select('*', { count: 'exact', head: true })
      .eq('accountId', req.params.id);
    
    if (kpiCount && kpiCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete account: This account has ${kpiCount} KPI(s) associated with it. Please delete the KPIs first.` 
      });
    }

    const { error } = await supabase.from('Account').delete().eq('id', req.params.id);
    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Account not found' });
      }
      return res.status(500).json({ error: error.message || 'Failed to delete account' });
    }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete account' });
  }
});

router.get('/:id/campaigns', async (req, res) => {
  const { data: account } = await supabase
    .from('Account')
    .select('id')
    .eq('id', req.params.id)
    .single();
  
  if (!account) return res.status(404).json({ error: 'Not found' });
  
  const { data: campaignLinks } = await supabase
    .from('_CampaignToAccount')
    .select('A')
    .eq('B', req.params.id);
  
  const campaignIds = campaignLinks?.map((link: any) => link.A) || [];
  const { data: campaigns } = await supabase
    .from('Campaign')
    .select('*')
    .in('id', campaignIds);
  
  res.json(campaigns || []);
});

export default router;
