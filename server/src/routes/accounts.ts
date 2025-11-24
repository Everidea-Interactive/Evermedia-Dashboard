import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRoles, AuthRequest } from '../middleware/auth.js';
import { recalculateKPIs } from '../utils/kpiRecalculation.js';
import { logActivity, getEntityName, computeChangedFields, generateChangeDescription } from '../utils/activityLog.js';

const router = Router();

router.use(requireAuth);

function withCrossbrand(account: any, campaignCount: number) {
  return { ...account, isCrossbrand: campaignCount >= 2 };
}

/**
 * Generates a TikTok handle from an account name
 * Converts to lowercase, removes special characters, replaces spaces
 * @param accountName The account name to convert
 * @returns A handle in the format @username
 */
function generateHandleFromName(accountName: string): string {
  if (!accountName || !accountName.trim()) {
    return '@account';
  }
  
  // Convert to lowercase and remove leading/trailing whitespace
  let handle = accountName.trim().toLowerCase();
  
  // Remove special characters, keep only alphanumeric and spaces
  handle = handle.replace(/[^a-z0-9\s]/g, '');
  
  // Replace spaces with nothing (remove spaces)
  handle = handle.replace(/\s+/g, '');
  
  // Remove leading/trailing spaces that might remain
  handle = handle.trim();
  
  // If empty after processing, use default
  if (!handle) {
    return '@account';
  }
  
  // Add @ prefix if not already present
  if (!handle.startsWith('@')) {
    handle = '@' + handle;
  }
  
  return handle;
}

/**
 * Generates a unique TikTok handle from an account name
 * Checks for existing handles and appends a number if needed
 * @param accountName The account name to convert
 * @param excludeAccountId Optional account ID to exclude from uniqueness check (for updates)
 * @returns A unique handle in the format @username or @username1, @username2, etc.
 */
async function generateUniqueHandle(accountName: string, excludeAccountId?: string): Promise<string> {
  const baseHandle = generateHandleFromName(accountName);
  
  // Check if handle already exists
  let query = supabase
    .from('Account')
    .select('id, tiktokHandle')
    .eq('tiktokHandle', baseHandle);
  
  if (excludeAccountId) {
    query = query.neq('id', excludeAccountId);
  }
  
  const { data: existing } = await query;
  
  // If handle doesn't exist, return it
  if (!existing || existing.length === 0) {
    return baseHandle;
  }
  
  // Extract base name without @
  const baseName = baseHandle.substring(1);
  let counter = 1;
  let uniqueHandle = `@${baseName}${counter}`;
  
  // Keep incrementing until we find a unique handle
  while (true) {
    let checkQuery = supabase
      .from('Account')
      .select('id')
      .eq('tiktokHandle', uniqueHandle);
    
    if (excludeAccountId) {
      checkQuery = checkQuery.neq('id', excludeAccountId);
    }
    
    const { data: existingWithNumber } = await checkQuery;
    
    if (!existingWithNumber || existingWithNumber.length === 0) {
      return uniqueHandle;
    }
    
    counter++;
    uniqueHandle = `@${baseName}${counter}`;
    
    // Safety check to prevent infinite loop
    if (counter > 1000) {
      // Fallback to timestamp-based handle
      return `@${baseName}${Date.now()}`;
    }
  }
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

router.post('/', requireRoles('ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR'), async (req: AuthRequest, res) => {
  const { name, tiktokHandle, accountType, brand, notes, campaignIds } = req.body;
  if (!name || !accountType) return res.status(400).json({ error: 'Missing fields' });
  
  // Auto-generate handle if not provided
  const finalTiktokHandle = tiktokHandle || await generateUniqueHandle(name);
  
  const { data: account, error } = await supabase
    .from('Account')
    .insert({ name, tiktokHandle: finalTiktokHandle, accountType, brand, notes })
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
    
    // Recalculate KPIs for newly linked campaigns
    for (const campaignId of campaignIds) {
      await recalculateKPIs(campaignId, account.id);
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
  
  // Log activity with specific fields
  const newValues = {
    name: account.name,
    tiktokHandle: account.tiktokHandle,
    accountType: account.accountType,
    brand: account.brand,
    notes: account.notes,
    campaignIds: campaignIds || [],
  };
  
  await logActivity(req, {
    action: 'CREATE',
    entityType: 'Account',
    entityId: account.id,
    entityName: getEntityName('Account', account),
    newValues,
    description: generateChangeDescription('CREATE', 'Account', getEntityName('Account', account), undefined, newValues),
  });
  
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

router.put('/:id', requireRoles('ADMIN', 'CAMPAIGN_MANAGER', 'EDITOR'), async (req: AuthRequest, res) => {
  const { name, tiktokHandle, accountType, brand, notes, campaignIds } = req.body;
  
  // Get old account data for logging
  const { data: oldAccount } = await supabase
    .from('Account')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
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
  
  // Add new campaign links if provided (only add, don't remove existing ones)
  if (campaignIds !== undefined && campaignIds.length > 0) {
    // Get existing campaign links
    const { data: oldLinks } = await supabase
      .from('_CampaignToAccount')
      .select('A')
      .eq('B', req.params.id);
    
    const existingCampaignIds = oldLinks?.map((link: any) => link.A) || [];
    
    // Only add campaigns that don't already exist
    const newCampaignIds = campaignIds.filter((id: string) => !existingCampaignIds.includes(id));
    
    if (newCampaignIds.length > 0) {
      const links = newCampaignIds.map((campaignId: string) => ({
        A: campaignId,
        B: req.params.id,
      }));
      await supabase.from('_CampaignToAccount').insert(links);
    
      // Recalculate KPIs for newly linked campaigns only
      for (const campaignId of newCampaignIds) {
      await recalculateKPIs(campaignId, req.params.id);
      }
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
  
  // Log activity with specific changed fields only
  const fieldsToCompare = Object.keys(updateData).filter(field => !['createdAt', 'updatedAt', 'id'].includes(field));
  const changedFields = computeChangedFields(
    oldAccount,
    account,
    fieldsToCompare
  );
  
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
      entityType: 'Account',
      entityId: account.id,
      entityName: getEntityName('Account', account),
      oldValues,
      newValues,
      description: generateChangeDescription('UPDATE', 'Account', getEntityName('Account', account), oldValues, newValues),
    });
  }
  
  const result = withCrossbrand({ ...account, campaigns: campaigns || [] }, campaigns?.length || 0);
  res.json(result);
});

router.delete('/:id', requireRoles('ADMIN', 'CAMPAIGN_MANAGER'), async (req: AuthRequest, res) => {
  try {
    // Get account data for logging before deletion
    const { data: account } = await supabase
      .from('Account')
      .select('*')
      .eq('id', req.params.id)
      .single();
    
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
    
    // Log activity with specific fields
    if (account) {
      const oldValues = {
        name: account.name,
        tiktokHandle: account.tiktokHandle,
        accountType: account.accountType,
        brand: account.brand,
        notes: account.notes,
      };
      
      await logActivity(req, {
        action: 'DELETE',
        entityType: 'Account',
        entityId: req.params.id,
        entityName: getEntityName('Account', account),
        oldValues,
        description: generateChangeDescription('DELETE', 'Account', getEntityName('Account', account), oldValues),
      });
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
