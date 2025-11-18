import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

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

router.post('/', async (req, res) => {
  const { campaignId, accountId, category, target, actual } = req.body as any;
  if (!campaignId || !category || target == null) return res.status(400).json({ error: 'Missing fields' });
  
  const { data: kpi, error } = await supabase
    .from('KPI')
    .insert({ campaignId, accountId, category, target, actual: actual ?? 0 })
    .select()
    .single();
  
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ ...kpi, remaining: kpi.target - kpi.actual });
});

router.put('/:id', async (req, res) => {
  const { target, actual } = req.body as any;
  
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
  res.json({ ...kpi, remaining: kpi.target - kpi.actual });
});

router.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('KPI').delete().eq('id', req.params.id);
  if (error) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

export default router;
