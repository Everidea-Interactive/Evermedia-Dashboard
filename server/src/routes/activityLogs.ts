import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth, requireRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRoles('ADMIN'));

// Get activity logs with optional filters
router.get('/', async (req, res) => {
  const { 
    userId, 
    entityType, 
    entityId, 
    action, 
    dateFrom, 
    dateTo,
    limit = 100,
    offset = 0 
  } = req.query as any;
  
  let query = supabase
    .from('ActivityLog')
    .select('*')
    .order('createdAt', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);
  
  if (userId) query = query.eq('userId', userId);
  if (entityType) query = query.eq('entityType', entityType);
  if (entityId) query = query.eq('entityId', entityId);
  if (action) query = query.eq('action', action);
  if (dateFrom) query = query.gte('createdAt', String(dateFrom));
  if (dateTo) query = query.lte('createdAt', String(dateTo));
  
  const { data: logs, error } = await query;
  
  if (error) return res.status(500).json({ error: error.message });
  
  // Get total count for pagination
  let countQuery = supabase
    .from('ActivityLog')
    .select('*', { count: 'exact', head: true });
  
  if (userId) countQuery = countQuery.eq('userId', userId);
  if (entityType) countQuery = countQuery.eq('entityType', entityType);
  if (entityId) countQuery = countQuery.eq('entityId', entityId);
  if (action) countQuery = countQuery.eq('action', action);
  if (dateFrom) countQuery = countQuery.gte('createdAt', String(dateFrom));
  if (dateTo) countQuery = countQuery.lte('createdAt', String(dateTo));
  
  const { count } = await countQuery;
  
  res.json({
    logs: logs || [],
    total: count || 0,
    limit: Number(limit),
    offset: Number(offset),
  });
});

// Get activity log by ID
router.get('/:id', async (req, res) => {
  const { data: log, error } = await supabase
    .from('ActivityLog')
    .select('*')
    .eq('id', req.params.id)
    .single();
  
  if (error || !log) return res.status(404).json({ error: 'Not found' });
  res.json(log);
});

export default router;

