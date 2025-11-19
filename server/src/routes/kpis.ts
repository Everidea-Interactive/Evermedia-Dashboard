import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { logActivity, getEntityName } from '../utils/activityLog.js';
import { recalculateKPIs, recalculateCampaignKPIs } from '../utils/kpiRecalculation.js';

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
  } else {
    await recalculateCampaignKPIs(campaignId);
  }
  
  // Fetch the updated KPI with recalculated actual value
  const { data: updatedKpi } = await supabase
    .from('KPI')
    .select('*')
    .eq('id', kpi.id)
    .single();
  
  // Log activity
  await logActivity(req, {
    action: 'CREATE',
    entityType: 'KPI',
    entityId: kpi.id,
    entityName: getEntityName('KPI', updatedKpi || kpi),
    newValues: updatedKpi || kpi,
  });
  
  const finalKpi = updatedKpi || kpi;
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
  
  // Log activity
  await logActivity(req, {
    action: 'UPDATE',
    entityType: 'KPI',
    entityId: kpi.id,
    entityName: getEntityName('KPI', kpi),
    oldValues: oldKpi,
    newValues: kpi,
  });
  
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
  
  // Log activity
  if (kpi) {
    await logActivity(req, {
      action: 'DELETE',
      entityType: 'KPI',
      entityId: req.params.id,
      entityName: getEntityName('KPI', kpi),
      oldValues: kpi,
    });
  }
  
  res.json({ ok: true });
});

export default router;
