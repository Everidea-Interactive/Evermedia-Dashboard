import { supabase } from '../supabase.js';

export async function recalculateKPIs(campaignId: string, accountId: string) {
  // Get all posts for this campaign and account
  const { data: posts } = await supabase
    .from('Post')
    .select('totalView, contentType, yellowCart')
    .eq('campaignId', campaignId)
    .eq('accountId', accountId);
  
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
    QTY_POST: posts?.length || 0,
    FYP_COUNT: 0,
    VIDEO_COUNT: 0,
    GMV_IDR: 0,
    YELLOW_CART: 0,
  };
  
  (posts || []).forEach((p: any) => {
    totals.VIEWS += p.totalView || 0;
    if (p.contentType === 'Video') {
      totals.VIDEO_COUNT += 1;
    }
    // Count as FYP if views meet or exceed the threshold
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
      await supabase
        .from('KPI')
        .update({ actual: totals[category] })
        .in('id', kpiIds);
    }
  }
}

export async function recalculateCampaignKPIs(campaignId: string) {
  // Get all posts for this campaign
  const { data: posts } = await supabase
    .from('Post')
    .select('totalView, contentType, yellowCart')
    .eq('campaignId', campaignId);
  
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
    QTY_POST: posts?.length || 0,
    FYP_COUNT: 0,
    VIDEO_COUNT: 0,
    GMV_IDR: 0,
    YELLOW_CART: 0,
  };
  
  (posts || []).forEach((p: any) => {
    totals.VIEWS += p.totalView || 0;
    if (p.contentType === 'Video') {
      totals.VIDEO_COUNT += 1;
    }
    // Count as FYP if views meet or exceed the threshold
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
      await supabase
        .from('KPI')
        .update({ actual: totals[category] })
        .in('id', kpiIds);
    }
  }
}

/**
 * Initialize or reset KPIs for an account in a campaign.
 * This is called when an account is automatically added to a campaign via post creation.
 * All KPIs are set to target=0 and actual=0.
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
  
  // Batch reset existing KPIs to target=0, actual=0
  if (existingKPIs && existingKPIs.length > 0) {
    const existingKpiIds = existingKPIs.map((k: any) => k.id);
    await supabase
      .from('KPI')
      .update({ target: 0, actual: 0 })
      .in('id', existingKpiIds);
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
    await supabase.from('KPI').insert(missingKPIs);
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
    await supabase
      .from('KPI')
      .update({ actual: totalGmv })
      .in('id', campaignGmvKpiIds);
  } else {
    // Create campaign-level GMV_IDR KPI if it doesn't exist
    await supabase
      .from('KPI')
      .insert({
        campaignId,
        accountId: null,
        category: 'GMV_IDR',
        target: 0,
        actual: totalGmv,
      });
  }
}

