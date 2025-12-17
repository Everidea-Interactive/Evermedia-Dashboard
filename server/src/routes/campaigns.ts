import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth.js';
import { recalculateKPIs } from '../utils/kpiRecalculation.js';
import { logActivity, getEntityName, computeChangedFields, generateChangeDescription } from '../utils/activityLog.js';

const normalizeQuotationNumber = (value: any): string | null | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const asString = String(value).trim();
  return asString === '' ? null : asString;
};

const normalizeAccountIds = (ids: unknown): string[] => {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const id of ids) {
    if (id === undefined || id === null) continue;
    const value = String(id);
    if (seen.has(value)) continue;
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
};

const haveSameAccountSets = (first: string[], second: string[]): boolean => {
  const firstSet = new Set(first);
  const secondSet = new Set(second);
  if (firstSet.size !== secondSet.size) return false;
  for (const id of firstSet) {
    if (!secondSet.has(id)) return false;
  }
  return true;
};

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { status, dateFrom, dateTo } = req.query as any;
  let query = supabase.from('Campaign').select('*').order('createdAt', { ascending: false });
  
  if (status) query = query.eq('status', status);
  if (dateFrom) query = query.gte('startDate', String(dateFrom));
  if (dateTo) query = query.lte('endDate', String(dateTo));
  
  const { data: campaigns, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(campaigns || []);
});

router.post('/', requireRoles('ADMIN', 'CAMPAIGN_MANAGER'), async (req: AuthRequest, res) => {
  const { name, categories, startDate, endDate, status, description, accountIds, targetViewsForFYP, quotationNumber, brandName } = req.body as any;
  if (!name || !startDate || !endDate || !status || !brandName || !brandName.trim()) {
    return res.status(400).json({ error: 'Missing fields: name, startDate, endDate, status, and brandName are required' });
  }

  const normalizedQuotationNumber = normalizeQuotationNumber(quotationNumber);
  const normalizedBrandName = String(brandName).trim();
  
  const { data: campaign, error } = await supabase
    .from('Campaign')
    .insert({
      name,
      categories: Array.isArray(categories) ? categories : [],
      startDate: new Date(startDate).toISOString(),
      endDate: new Date(endDate).toISOString(),
      status,
      description,
      quotationNumber: normalizedQuotationNumber ?? null,
      targetViewsForFYP: targetViewsForFYP !== undefined ? Number(targetViewsForFYP) : null,
      brandName: normalizedBrandName,
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
    
    // Recalculate KPIs for newly linked accounts
    for (const accountId of accountIds) {
      await recalculateKPIs(campaign.id, accountId);
    }
  }
  
  // Log activity with specific fields
  if (campaign) {
    const newValues = {
      name: campaign.name,
      categories: campaign.categories,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      status: campaign.status,
      description: campaign.description,
      quotationNumber: campaign.quotationNumber,
      targetViewsForFYP: campaign.targetViewsForFYP,
      brandName: campaign.brandName,
      accountIds: accountIds || [],
    };
    
    await logActivity(req, {
      action: 'CREATE',
      entityType: 'Campaign',
      entityId: campaign.id,
      entityName: getEntityName('Campaign', campaign),
      newValues,
      description: generateChangeDescription('CREATE', 'Campaign', getEntityName('Campaign', campaign), undefined, newValues),
    });
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

router.put('/:id', requireRoles('ADMIN', 'CAMPAIGN_MANAGER'), async (req: AuthRequest, res) => {
  const { name, categories, startDate, endDate, status, description, accountIds, targetViewsForFYP, quotationNumber, brandName } = req.body as any;
  const normalizedRequestedAccountIds = normalizeAccountIds(accountIds);
  
  // Get old campaign data for logging
  const { data: oldCampaign } = await supabase
    .from('Campaign')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (categories !== undefined) updateData.categories = Array.isArray(categories) ? categories : [];
  if (startDate) updateData.startDate = new Date(startDate).toISOString();
  if (endDate) updateData.endDate = new Date(endDate).toISOString();
  if (status !== undefined) updateData.status = status;
  if (description !== undefined) updateData.description = description;
  if (targetViewsForFYP !== undefined) updateData.targetViewsForFYP = targetViewsForFYP !== null && targetViewsForFYP !== '' ? Number(targetViewsForFYP) : null;
  if (quotationNumber !== undefined) {
    updateData.quotationNumber = normalizeQuotationNumber(quotationNumber);
  }
  if (brandName !== undefined) {
    const trimmedBrandName = String(brandName).trim();
    if (!trimmedBrandName) {
      return res.status(400).json({ error: 'brandName is required and cannot be empty' });
    }
    updateData.brandName = trimmedBrandName;
  }
  
  const { data: campaign, error } = await supabase
    .from('Campaign')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();
  
  if (error || !campaign) return res.status(404).json({ error: 'Not found' });
  
  // Get old account links before updating (for logging and KPI recalculation)
  let oldAccountIds: string[] = [];
  if (accountIds !== undefined) {
    const { data: oldLinks } = await supabase
      .from('_CampaignToAccount')
      .select('B')
      .eq('A', req.params.id);
    
    oldAccountIds = oldLinks?.map((link: any) => link.B) || [];
    
    const accountLinksChanged = !haveSameAccountSets(oldAccountIds, normalizedRequestedAccountIds);
    if (accountLinksChanged) {
      const newAccountIdSet = new Set(normalizedRequestedAccountIds);
      const accountsToRemove = oldAccountIds.filter((id: string) => !newAccountIdSet.has(id));
      
      // Check if any accounts being removed have posts in this campaign
      if (accountsToRemove.length > 0) {
        const { data: posts, error: postsError } = await supabase
          .from('Post')
          .select('accountId')
          .eq('campaignId', req.params.id)
          .in('accountId', accountsToRemove)
          .limit(1);
        
        if (postsError) {
          return res.status(500).json({ error: `Failed to check posts: ${postsError.message}` });
        }
        
        if (posts && posts.length > 0) {
          return res.status(400).json({ 
            error: `Cannot remove account from campaign: There are existing posts using this account in this campaign` 
          });
        }
      }
      
      await supabase.from('_CampaignToAccount').delete().eq('A', req.params.id);
      if (normalizedRequestedAccountIds.length > 0) {
        const links = normalizedRequestedAccountIds.map((accountId: string) => ({
          A: req.params.id,
          B: accountId,
        }));
        await supabase.from('_CampaignToAccount').insert(links);
      }
      
      const allAffectedAccountIds = [...new Set([...oldAccountIds, ...normalizedRequestedAccountIds])];
      await Promise.all(allAffectedAccountIds.map((accountId) => recalculateKPIs(req.params.id, accountId)));
    }
  }
  
  // Log activity with specific changed fields only
  const changedFields = computeChangedFields(
    oldCampaign,
    campaign,
    Object.keys(updateData)
  );
  
  // Also track account links changes if they were updated
  if (accountIds !== undefined && oldCampaign) {
    const oldAccountIdsSorted = [...oldAccountIds].sort().join(',');
    const newAccountIdsSorted = [...normalizedRequestedAccountIds].sort().join(',');
    
    if (oldAccountIdsSorted !== newAccountIdsSorted) {
      changedFields.accountIds = {
        before: oldAccountIds,
        after: normalizedRequestedAccountIds,
      };
    }
  }
  
  // Build oldValues and newValues objects from changedFields
  const oldValues: any = {};
  const newValues: any = {};
  
  for (const [field, change] of Object.entries(changedFields)) {
    oldValues[field] = change.before;
    newValues[field] = change.after;
  }
  
  const hasChanges = Object.keys(oldValues).length > 0;
  
  // Only log if there are actual changes
  if (hasChanges) {
    await logActivity(req, {
      action: 'UPDATE',
      entityType: 'Campaign',
      entityId: campaign.id,
      entityName: getEntityName('Campaign', campaign),
      oldValues,
      newValues,
      description: generateChangeDescription('UPDATE', 'Campaign', getEntityName('Campaign', campaign), oldValues, newValues),
    });
  }
  
  res.json(campaign);
});

router.delete('/:id', requireRoles('ADMIN', 'CAMPAIGN_MANAGER'), async (req: AuthRequest, res) => {
  const campaignId = req.params.id;
  
  // First, check if campaign exists and get full data for logging
  const { data: campaign } = await supabase
    .from('Campaign')
    .select('*')
    .eq('id', campaignId)
    .single();
  
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' });
  }
  
  // Delete related data in parallel (independent operations)
  // Note: Campaign deletion must happen last due to foreign key constraints
  const [postsDeleteResult, linksDeleteResult, kpisDeleteResult] = await Promise.all([
    supabase.from('Post').delete().eq('campaignId', campaignId),
    supabase.from('_CampaignToAccount').delete().eq('A', campaignId),
    supabase.from('KPI').delete().eq('campaignId', campaignId),
  ]);
  
  // Check for errors in parallel deletions
  if (postsDeleteResult.error) {
    return res.status(500).json({ error: `Failed to delete posts: ${postsDeleteResult.error.message}` });
  }
  if (linksDeleteResult.error) {
    return res.status(500).json({ error: `Failed to delete campaign links: ${linksDeleteResult.error.message}` });
  }
  if (kpisDeleteResult.error) {
    return res.status(500).json({ error: `Failed to delete KPIs: ${kpisDeleteResult.error.message}` });
  }
  
  // Delete the campaign (must be last due to foreign key constraints)
  const { error } = await supabase.from('Campaign').delete().eq('id', campaignId);
  if (error) return res.status(500).json({ error: error.message });
  
  // Log activity with specific fields
  const oldValues = {
    name: campaign.name,
    categories: campaign.categories,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    status: campaign.status,
    description: campaign.description,
    quotationNumber: campaign.quotationNumber,
    targetViewsForFYP: campaign.targetViewsForFYP,
    brandName: campaign.brandName,
  };
  
  await logActivity(req, {
    action: 'DELETE',
    entityType: 'Campaign',
    entityId: campaignId,
    entityName: getEntityName('Campaign', campaign),
    oldValues,
    description: generateChangeDescription('DELETE', 'Campaign', getEntityName('Campaign', campaign), oldValues),
  });
  
  res.json({ ok: true });
});

router.get('/:id/kpis', async (req, res) => {
  const { data: kpis, error } = await supabase
    .from('KPI')
    .select('*')
    .eq('campaignId', req.params.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json((kpis || []).map((k: any) => {
    const target = k.target ?? 0;
    const actual = k.actual ?? 0;
    return { ...k, target, actual, remaining: target - actual };
  }));
});

// Convenience: /api/campaigns/:id/posts with filters and pagination
router.get('/:id/posts', async (req, res) => {
  const id = req.params.id;
  const { dateFrom, dateTo, picTalentId, picEditorId, picPostingId, accountId, status, category, contentType, limit, offset } = req.query as any;
  
  // Build base query for filtering
  let countQuery = supabase.from('Post').select('*', { count: 'exact', head: true }).eq('campaignId', id);
  let query = supabase.from('Post').select('*').eq('campaignId', id);
  
  if (accountId) {
    countQuery = countQuery.eq('accountId', accountId);
    query = query.eq('accountId', accountId);
  }
  if (status) {
    countQuery = countQuery.ilike('status', `%${String(status)}%`);
    query = query.ilike('status', `%${String(status)}%`);
  }
  if (category) {
    countQuery = countQuery.ilike('contentCategory', `%${String(category)}%`);
    query = query.ilike('contentCategory', `%${String(category)}%`);
  }
  if (contentType) {
    countQuery = countQuery.ilike('contentType', `%${String(contentType)}%`);
    query = query.ilike('contentType', `%${String(contentType)}%`);
  }
  if (dateFrom) {
    countQuery = countQuery.gte('postDate', String(dateFrom));
    query = query.gte('postDate', String(dateFrom));
  }
  if (dateTo) {
    countQuery = countQuery.lte('postDate', String(dateTo));
    query = query.lte('postDate', String(dateTo));
  }
  if (picTalentId) {
    countQuery = countQuery.eq('picTalentId', picTalentId);
    query = query.eq('picTalentId', picTalentId);
  }
  if (picEditorId) {
    countQuery = countQuery.eq('picEditorId', picEditorId);
    query = query.eq('picEditorId', picEditorId);
  }
  if (picPostingId) {
    countQuery = countQuery.eq('picPostingId', picPostingId);
    query = query.eq('picPostingId', picPostingId);
  }
  
  // Get total count
  const { count, error: countError } = await countQuery;
  if (countError) return res.status(500).json({ error: countError.message });
  
  // Apply pagination
  const limitNum = limit ? parseInt(String(limit), 10) : undefined;
  const offsetNum = offset ? parseInt(String(offset), 10) : undefined;
  if (limitNum !== undefined) query = query.limit(limitNum);
  if (offsetNum !== undefined) query = query.range(offsetNum, offsetNum + (limitNum || 0) - 1);
  
  // Apply ordering
  const { data: posts, error } = await query.order('postDate', { ascending: false }).order('createdAt', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  
  // Fetch related data - parallelize independent queries
  const accountIds = [...new Set((posts || []).map((p: any) => p.accountId))];
  const picIds = [...new Set((posts || []).flatMap((p: any) => [p.picTalentId, p.picEditorId, p.picPostingId]).filter(Boolean))];
  
  const [accountsResult, picsResult, campaignResult] = await Promise.all([
    supabase.from('Account').select('id, name').in('id', accountIds),
    supabase.from('PIC').select('id, name').in('id', picIds),
    supabase.from('Campaign').select('id, name').eq('id', id).single(),
  ]);
  
  const accounts = accountsResult.data || [];
  const pics = picsResult.data || [];
  const campaign = campaignResult.data || null;
  
  const accountMap = new Map(accounts.map((a: any) => [a.id, a]));
  const picMap = new Map(pics.map((p: any) => [p.id, p]));
  
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
  
  // Return paginated response
  res.json({
    posts: mapped,
    total: count || 0,
    limit: limitNum,
    offset: offsetNum || 0,
  });
});

router.post('/:id/accounts/:accountId/recalculate-kpis', requireRoles('ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR'), async (req, res) => {
  const { id, accountId } = req.params;
  
  try {
    await recalculateKPIs(id, accountId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message || 'Failed to recalculate KPIs' });
  }
});

router.delete('/:id/accounts/:accountId', async (req, res) => {
  const { id, accountId } = req.params;
  
  // Check if there are any posts using this account in this campaign
  const { data: posts, error: postsError } = await supabase
    .from('Post')
    .select('id')
    .eq('campaignId', id)
    .eq('accountId', accountId)
    .limit(1);
  
  if (postsError) {
    return res.status(500).json({ error: `Failed to check posts: ${postsError.message}` });
  }
  
  if (posts && posts.length > 0) {
    return res.status(400).json({ 
      error: 'Cannot remove account from campaign: There are existing posts using this account in this campaign' 
    });
  }
  
  const { error } = await supabase
    .from('_CampaignToAccount')
    .delete()
    .eq('A', id)
    .eq('B', accountId);
  
  if (error) return res.status(404).json({ error: 'Not found' });
  
  // Recalculate KPIs for the unlinked account
  await recalculateKPIs(id, accountId);
  
  res.json({ ok: true });
});

export default router;
