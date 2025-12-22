import { Router } from 'express';
import { supabase } from '../supabase.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

function engagementRate(sum: { views: number; likes: number; comments: number; shares: number; saves: number }) {
  const { views, likes, comments, shares, saves } = sum;
  return views === 0 ? 0 : Number(((likes + comments + shares + saves) / views).toFixed(4));
}

// Helper function to fetch all posts with pagination
async function fetchAllPosts(selectFields: string, filterFn?: (query: any) => any): Promise<any[]> {
  const allPosts: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('Post')
      .select(selectFields)
      .order('id', { ascending: true }) // Ensure consistent pagination ordering
      .range(offset, offset + pageSize - 1);
    
    if (filterFn) {
      query = filterFn(query);
    }
    
    const { data: posts, error } = await query;
    
    if (error) {
      throw error;
    }
    
    if (posts && posts.length > 0) {
      allPosts.push(...posts);
      offset += pageSize;
      hasMore = posts.length === pageSize;
    } else {
      hasMore = false;
    }
  }
  
  return allPosts;
}

router.get('/campaigns/dashboard/engagement/batch', async (req, res) => {
  const { campaignIds } = req.query as any;
  if (!campaignIds) {
    return res.status(400).json({ error: 'campaignIds query parameter is required' });
  }

  const ids = Array.isArray(campaignIds) ? campaignIds : String(campaignIds).split(',').filter(Boolean);
  if (ids.length === 0) {
    return res.json({});
  }

  try {
    const posts = await fetchAllPosts(
      'campaignId, totalView, totalLike, totalComment, totalShare, totalSaved',
      (query) => query.in('campaignId', ids)
    );

    const totals = new Map<string, { views: number; likes: number; comments: number; shares: number; saves: number }>();
    ids.forEach((campaignId) => {
      totals.set(campaignId, { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 });
    });

    posts.forEach((post: any) => {
      const campaignId = post.campaignId;
      if (!campaignId) return;
      const sum = totals.get(campaignId) ?? { views: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
      sum.views += Number(post.totalView) || 0;
      sum.likes += Number(post.totalLike) || 0;
      sum.comments += Number(post.totalComment) || 0;
      sum.shares += Number(post.totalShare) || 0;
      sum.saves += Number(post.totalSaved) || 0;
      totals.set(campaignId, sum);
    });

    const data: Record<string, any> = {};
    totals.forEach((sum, campaignId) => {
      data[campaignId] = { ...sum, engagementRate: engagementRate(sum) };
    });

    res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/campaigns/:id/dashboard/engagement', async (req, res) => {
  const campaignId = req.params.id;
  
  try {
    // Fetch all posts with pagination to handle campaigns with more than 1000 posts
    const posts = await fetchAllPosts(
      'totalView, totalLike, totalComment, totalShare, totalSaved',
      (query) => query.eq('campaignId', campaignId)
    );
    
    const sum = posts.reduce(
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
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/campaigns/:id/dashboard/categories', async (req, res) => {
  const campaignId = req.params.id;
  
  try {
    // Fetch all posts with pagination to handle campaigns with more than 1000 posts
    const posts = await fetchAllPosts(
      'campaignCategory, totalView',
      (query) => query.eq('campaignId', campaignId)
    );

    const totals = posts.reduce((map: Map<string, { posts: number; views: number }>, post: any) => {
      const category = (post.campaignCategory || '').trim() || 'Uncategorized';
      const current = map.get(category) ?? { posts: 0, views: 0 };
      const views = typeof post.totalView === 'number' ? post.totalView : Number(post.totalView) || 0;
      map.set(category, { posts: current.posts + 1, views: current.views + views });
      return map;
    }, new Map<string, { posts: number; views: number }>());

    const data = Array.from(totals.entries()).map(([category, stats]) => ({
      category,
      posts: stats.posts,
      views: stats.views,
    }));

    data.sort((a, b) => b.posts - a.posts || b.views - a.views || a.category.localeCompare(b.category));
    res.json(data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/campaigns/all/engagement', async (req, res) => {
  try {
    // Fetch all posts with pagination to handle databases with more than 1000 posts
    const posts = await fetchAllPosts('totalView, totalLike, totalComment, totalShare, totalSaved');
    
    const sum = posts.reduce(
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
    
    // Get total count of all campaigns
    const { count: campaignsCount, error: campaignsError } = await supabase
      .from('Campaign')
      .select('*', { count: 'exact', head: true });
    
    if (campaignsError) return res.status(500).json({ error: campaignsError.message });
    
    res.json({ 
      ...sum, 
      engagementRate: engagementRate(sum),
      projectNumbersCount: campaignsCount || 0
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
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
