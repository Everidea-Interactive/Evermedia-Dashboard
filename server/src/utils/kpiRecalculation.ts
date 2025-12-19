import { supabase } from '../supabase.js';

// Helper function to fetch all posts in batches
async function fetchAllPostsForKPI(campaignId: string, accountId?: string) {
  const allPosts: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    let query = supabase
      .from('Post')
      .select('totalView, contentType, yellowCart, fypType')
      .eq('campaignId', campaignId)
      .range(offset, offset + pageSize - 1);
    
    if (accountId) {
      query = query.eq('accountId', accountId);
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

export async function recalculateKPIs(campaignId: string, accountId: string) {
  // Get all posts for this campaign and account (fetch in batches to handle >1000 posts)
  const posts = await fetchAllPostsForKPI(campaignId, accountId);
  
  // Get campaign to check targetViewsForFYP
  const { data: campaign } = await supabase
    .from('Campaign')
    .select('targetViewsForFYP')
    .eq('id', campaignId)
    .single();
  
  // Get all KPIs for this campaign and account
  const { data: kpis } = await supabase
    .from('KPI')
    .select('*')
    .eq('campaignId', campaignId)
    .eq('accountId', accountId);
  
  if (!kpis || kpis.length === 0) return;
  
  const targetViewsForFYP = campaign?.targetViewsForFYP;
  
  // Calculate totals from posts
  const totals: Record<string, number> = {
    VIEWS: 0,
    QTY_POST: posts.length,
    FYP_COUNT: 0,
    VIDEO_COUNT: 0,
    GMV_IDR: 0,
    YELLOW_CART: 0,
  };

  posts.forEach((p: any) => {
    totals.VIEWS += p.totalView || 0;
    if (p.contentType === 'Video') {
      totals.VIDEO_COUNT += 1;
    }
    // Count as FYP if views meet or exceed the threshold (regardless of fypType)
    if (targetViewsForFYP !== null && targetViewsForFYP !== undefined && (p.totalView || 0) >= targetViewsForFYP) {
      totals.FYP_COUNT += 1;
    }
    // Count posts with yellow cart enabled
    if (p.yellowCart === true || p.yellowCart === 1 || p.yellowCart === 'true') {
      totals.YELLOW_CART += 1;
    }
  });
  
  // Batch update KPIs by category for better performance
  // Group KPIs by category and update in batches
  const updatesByCategory = new Map<string, string[]>();
  
  for (const kpi of kpis) {
    const category = kpi.category;
    if (category in totals) {
      if (!updatesByCategory.has(category)) {
        updatesByCategory.set(category, []);
      }
      updatesByCategory.get(category)!.push(kpi.id);
    }
  }
  
  // Batch update all KPIs of the same category at once
  for (const [category, kpiIds] of updatesByCategory) {
    if (kpiIds.length > 0 && category in totals) {
      const { error } = await supabase
        .from('KPI')
        .update({ actual: totals[category] })
        .in('id', kpiIds);
      
      if (error) {
        console.error(`Failed to update KPIs for category ${category} in campaign ${campaignId}, account ${accountId}:`, error);
        // Continue with other updates even if one fails
      }
    }
  }
}

export async function recalculateCampaignKPIs(campaignId: string) {
  // Get all posts for this campaign (fetch in batches to handle >1000 posts)
  const posts = await fetchAllPostsForKPI(campaignId);
  
  // Get campaign to check targetViewsForFYP
  const { data: campaign } = await supabase
    .from('Campaign')
    .select('targetViewsForFYP')
    .eq('id', campaignId)
    .single();
  
  // Get campaign-level KPIs (where accountId is null)
  const { data: kpis } = await supabase
    .from('KPI')
    .select('*')
    .eq('campaignId', campaignId)
    .is('accountId', null);
  
  if (!kpis || kpis.length === 0) return;
  
  const targetViewsForFYP = campaign?.targetViewsForFYP;
  
  // Calculate totals from all posts in the campaign
  const totals: Record<string, number> = {
    VIEWS: 0,
    QTY_POST: posts.length,
    FYP_COUNT: 0,
    VIDEO_COUNT: 0,
    GMV_IDR: 0,
    YELLOW_CART: 0,
  };

  posts.forEach((p: any) => {
    totals.VIEWS += p.totalView || 0;
    if (p.contentType === 'Video') {
      totals.VIDEO_COUNT += 1;
    }
    // Count as FYP if views meet or exceed the threshold (regardless of fypType)
    if (targetViewsForFYP !== null && targetViewsForFYP !== undefined && (p.totalView || 0) >= targetViewsForFYP) {
      totals.FYP_COUNT += 1;
    }
    // Count posts with yellow cart enabled
    if (p.yellowCart === true || p.yellowCart === 1 || p.yellowCart === 'true') {
      totals.YELLOW_CART += 1;
    }
  });
  
  // Batch update KPIs by category for better performance
  // Group KPIs by category and update in batches
  const updatesByCategory = new Map<string, string[]>();
  
  for (const kpi of kpis) {
    const category = kpi.category;
    if (category in totals) {
      if (!updatesByCategory.has(category)) {
        updatesByCategory.set(category, []);
      }
      updatesByCategory.get(category)!.push(kpi.id);
    }
  }
  
  // Batch update all KPIs of the same category at once
  for (const [category, kpiIds] of updatesByCategory) {
    if (kpiIds.length > 0 && category in totals) {
      const { error } = await supabase
        .from('KPI')
        .update({ actual: totals[category] })
        .in('id', kpiIds);
      
      if (error) {
        console.error(`Failed to update campaign-level KPIs for category ${category} in campaign ${campaignId}:`, error);
        // Continue with other updates even if one fails
      }
    }
  }
}

/**
 * Initialize or reset KPIs for an account in a campaign.
 * This is called when an account is automatically added to a campaign via post creation.
 * Creates missing KPIs and resets actual values to 0 (preserves existing targets).
 * The actual values will be recalculated from posts after this function is called.
 */
export async function initializeAccountKPIs(campaignId: string, accountId: string) {
  const categories = ['VIEWS', 'QTY_POST', 'FYP_COUNT', 'VIDEO_COUNT', 'GMV_IDR', 'YELLOW_CART'];
  
  // Get existing KPIs for this campaign and account
  const { data: existingKPIs } = await supabase
    .from('KPI')
    .select('*')
    .eq('campaignId', campaignId)
    .eq('accountId', accountId);
  
  const existingCategories = new Set((existingKPIs || []).map((k: any) => k.category));
  
  // Reset actual values to 0 for existing KPIs (preserve targets)
  // This ensures that when recalculateKPIs is called, it will recalculate from scratch
  if (existingKPIs && existingKPIs.length > 0) {
    const existingKpiIds = existingKPIs.map((k: any) => k.id);
    const { error: updateError } = await supabase
      .from('KPI')
      .update({ actual: 0 })
      .in('id', existingKpiIds);
    
    if (updateError) {
      console.error(`Failed to reset KPI actual values for campaign ${campaignId}, account ${accountId}:`, updateError);
    }
  }
  
  // Batch create missing KPIs with target=0, actual=0
  const missingKPIs = categories
    .filter(category => !existingCategories.has(category))
    .map(category => ({
      campaignId,
      accountId,
      category,
      target: 0,
      actual: 0,
    }));
  
  if (missingKPIs.length > 0) {
    const { error: insertError } = await supabase.from('KPI').insert(missingKPIs);
    if (insertError) {
      console.error(`Failed to create missing KPIs for campaign ${campaignId}, account ${accountId}:`, insertError);
    }
  }
}

/**
 * Recalculate campaign-level GMV_IDR by summing all account-level GMV_IDR values for the campaign.
 * This is called when an account's GMV is manually updated.
 */
export async function recalculateCampaignGMV(campaignId: string) {
  // Get all account-level GMV_IDR KPIs for this campaign
  const { data: accountGmvKpis } = await supabase
    .from('KPI')
    .select('actual')
    .eq('campaignId', campaignId)
    .eq('category', 'GMV_IDR')
    .not('accountId', 'is', null);
  
  // Sum all account GMV values
  const totalGmv = (accountGmvKpis || []).reduce((sum, kpi) => sum + (kpi.actual || 0), 0);
  
  // Get campaign-level GMV_IDR KPI
  const { data: campaignGmvKpis } = await supabase
    .from('KPI')
    .select('*')
    .eq('campaignId', campaignId)
    .eq('category', 'GMV_IDR')
    .is('accountId', null);
  
  // Update campaign-level GMV_IDR KPI
  if (campaignGmvKpis && campaignGmvKpis.length > 0) {
    const campaignGmvKpiIds = campaignGmvKpis.map((k: any) => k.id);
    const { error: updateError } = await supabase
      .from('KPI')
      .update({ actual: totalGmv })
      .in('id', campaignGmvKpiIds);
    
    if (updateError) {
      console.error(`Failed to update campaign-level GMV_IDR for campaign ${campaignId}:`, updateError);
    }
  } else {
    // Create campaign-level GMV_IDR KPI if it doesn't exist
    const { error: insertError } = await supabase
      .from('KPI')
      .insert({
        campaignId,
        accountId: null,
        category: 'GMV_IDR',
        target: 0,
        actual: totalGmv,
      });
    
    if (insertError) {
      console.error(`Failed to create campaign-level GMV_IDR for campaign ${campaignId}:`, insertError);
    }
  }
}

