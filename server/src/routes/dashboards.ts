import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function engagementRate(sum: { views: number; likes: number; comments: number; shares: number; saves: number }) {
  const { views, likes, comments, shares, saves } = sum;
  return views === 0 ? 0 : Number(((likes + comments + shares + saves) / views).toFixed(4));
}

router.get('/campaigns/:id/dashboard/engagement', async (req, res) => {
  const campaignId = req.params.id;
  const { data: posts, error } = await supabase
    .from('Post')
    .select('totalView, totalLike, totalComment, totalShare, totalSaved')
    .eq('campaignId', campaignId);
  
  if (error) return res.status(500).json({ error: error.message });
  
  const sum = (posts || []).reduce(
    (acc: any, p: any) => {
      acc.views += p.totalView || 0;
      acc.likes += p.totalLike || 0;
      acc.comments += p.totalComment || 0;
      acc.shares += p.totalShare || 0;
      acc.saves += p.totalSaved || 0;
      return acc;
    },
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
  );
  res.json({ ...sum, engagementRate: engagementRate(sum) });
});

router.get('/campaigns/all/engagement', async (req, res) => {
  const { data: posts, error } = await supabase
    .from('Post')
    .select('totalView, totalLike, totalComment, totalShare, totalSaved');
  
  if (error) return res.status(500).json({ error: error.message });
  
  const sum = (posts || []).reduce(
    (acc: any, p: any) => {
      acc.views += p.totalView || 0;
      acc.likes += p.totalLike || 0;
      acc.comments += p.totalComment || 0;
      acc.shares += p.totalShare || 0;
      acc.saves += p.totalSaved || 0;
      return acc;
    },
    { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 }
  );
  res.json({ ...sum, engagementRate: engagementRate(sum) });
});

router.get('/campaigns/:id/dashboard/kpi', async (req, res) => {
  const campaignId = req.params.id;
  const { kpiCategory, accountId, crossbrandOnly } = req.query as any;

  let query = supabase.from('KPI').select('*').eq('campaignId', campaignId);
  if (kpiCategory) query = query.eq('category', kpiCategory);
  if (accountId) query = query.eq('accountId', accountId);
  
  const { data: kpis, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  
  // Filter by crossbrand if needed
  let filteredKpis = kpis || [];
  if (crossbrandOnly === 'true') {
    const accountIds = [...new Set((kpis || []).map((k: any) => k.accountId).filter(Boolean))];
    
    // Get campaign counts for each account
    const { data: campaignLinks } = await supabase
      .from('_CampaignToAccount')
      .select('A, B')
      .in('B', accountIds);
    
    const accountCampaignCounts = new Map<string, number>();
    (campaignLinks || []).forEach((link: any) => {
      accountCampaignCounts.set(link.B, (accountCampaignCounts.get(link.B) || 0) + 1);
    });
    
    filteredKpis = (kpis || []).filter((k: any) => {
      if (!k.accountId) return false;
      return (accountCampaignCounts.get(k.accountId) || 0) >= 2;
    });
  }

  const data = filteredKpis.map((k: any) => {
    const target = k.target ?? 0;
    const actual = k.actual ?? 0;
    return {
      id: k.id,
      campaignId: k.campaignId,
      accountId: k.accountId,
      category: k.category,
      target,
      actual,
      remaining: target - actual,
    };
  });
  res.json(data);
});

export default router;
