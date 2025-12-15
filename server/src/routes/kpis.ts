import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { logActivity, getEntityName, computeChangedFields, generateChangeDescription } from '../utils/activityLog.js';
import { recalculateKPIs, recalculateCampaignKPIs, recalculateCampaignGMV } from '../utils/kpiRecalculation.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const { campaignId, accountId } = req.query as any;
  let query = supabase.from('KPI').select('*');
  
  if (campaignId) query = query.eq('campaignId', campaignId);
  if (accountId) query = query.eq('accountId', accountId);
  
  const { data: kpis, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json((kpis || []).map((k: any) => ({ ...k, remaining: k.target - k.actual })));
});

router.post('/', async (req: AuthRequest, res) => {
  const { campaignId, accountId, category, target, actual } = req.body as any;
  if (!campaignId || !category || target == null) return res.status(400).json({ error: 'Missing fields' });
  
  const { data: kpi, error } = await supabase
    .from('KPI')
    .insert({ campaignId, accountId, category, target, actual: actual ?? 0 })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  
  // Recalculate KPIs to populate actual values from existing posts
  if (accountId) {
    await recalculateKPIs(campaignId, accountId);
    // If creating an account-level GMV_IDR KPI, also update campaign-level GMV
    if (category === 'GMV_IDR') {
      await recalculateCampaignGMV(campaignId);
    }
  } else {
    await recalculateCampaignKPIs(campaignId);
  }
  
  // Fetch the updated KPI with recalculated actual value
  const { data: updatedKpi } = await supabase
    .from('KPI')
    .select('*')
    .eq('id', kpi.id)
    .single();
  
  // Log activity with specific fields
  const finalKpi = updatedKpi || kpi;
  const newValues = {
    category: finalKpi.category,
    campaignId: finalKpi.campaignId,
    accountId: finalKpi.accountId,
    target: finalKpi.target,
    actual: finalKpi.actual,
  };
  
  await logActivity(req, {
    action: 'CREATE',
    entityType: 'KPI',
    entityId: kpi.id,
    entityName: getEntityName('KPI', finalKpi),
    newValues,
    description: generateChangeDescription('CREATE', 'KPI', getEntityName('KPI', finalKpi), undefined, newValues),
  });
  
  res.status(201).json({ ...finalKpi, remaining: finalKpi.target - finalKpi.actual });
});

router.put('/:id', async (req: AuthRequest, res) => {
  const { target, actual } = req.body as any;
  
  // Get old KPI data for logging
  const { data: oldKpi } = await supabase
    .from('KPI')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  const updateData: any = {};
  if (target !== undefined) updateData.target = target;
  if (actual !== undefined) updateData.actual = actual;
  
  const { data: kpi, error } = await supabase
    .from('KPI')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();
  
  if (error || !kpi) return res.status(404).json({ error: 'Not found' });
  
  // If an account's GMV_IDR actual was updated, recalculate campaign-level GMV
  if (kpi.accountId && kpi.category === 'GMV_IDR' && actual !== undefined) {
    await recalculateCampaignGMV(kpi.campaignId);
  }
  
  // Log activity with specific changed fields only
  // Only compare fields that were actually requested to be updated
  const fieldsToCompare = Object.keys(updateData).filter(field => !['createdAt', 'updatedAt', 'id'].includes(field));
  const changedFields = computeChangedFields(
    oldKpi,
    kpi,
    fieldsToCompare
  );
  
  // Build oldValues and newValues objects from changedFields (only fields that actually changed)
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
      entityType: 'KPI',
      entityId: kpi.id,
      entityName: getEntityName('KPI', kpi),
      oldValues,
      newValues,
      description: generateChangeDescription('UPDATE', 'KPI', getEntityName('KPI', kpi), oldValues, newValues),
    });
  }
  
  res.json({ ...kpi, remaining: kpi.target - kpi.actual });
});

router.delete('/:id', async (req: AuthRequest, res) => {
  // Get KPI data for logging before deletion
  const { data: kpi } = await supabase
    .from('KPI')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  const { error } = await supabase.from('KPI').delete().eq('id', req.params.id);
  if (error) return res.status(404).json({ error: 'Not found' });
  
  // If an account's GMV_IDR KPI was deleted, recalculate campaign-level GMV
  if (kpi && kpi.accountId && kpi.category === 'GMV_IDR') {
    await recalculateCampaignGMV(kpi.campaignId);
  }
  
  // Log activity with specific fields
  if (kpi) {
    const oldValues = {
      category: kpi.category,
      campaignId: kpi.campaignId,
      accountId: kpi.accountId,
      target: kpi.target,
      actual: kpi.actual,
    };
    
    await logActivity(req, {
      action: 'DELETE',
      entityType: 'KPI',
      entityId: req.params.id,
      entityName: getEntityName('KPI', kpi),
      oldValues,
      description: generateChangeDescription('DELETE', 'KPI', getEntityName('KPI', kpi), oldValues),
    });
  }
  
  res.json({ ok: true });
});

export default router;
