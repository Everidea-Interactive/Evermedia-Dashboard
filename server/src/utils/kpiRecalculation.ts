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
    if (p.yellowCart === true) {
      totals.YELLOW_CART += 1;
    }
  });
  
  // Update each KPI's actual value
  for (const kpi of kpis) {
    const category = kpi.category;
    if (category in totals) {
      const newActual = totals[category];
      await supabase
        .from('KPI')
        .update({ actual: newActual })
        .eq('id', kpi.id);
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
    if (p.yellowCart === true) {
      totals.YELLOW_CART += 1;
    }
  });
  
  // Update each KPI's actual value
  for (const kpi of kpis) {
    const category = kpi.category;
    if (category in totals) {
      const newActual = totals[category];
      await supabase
        .from('KPI')
        .update({ actual: newActual })
        .eq('id', kpi.id);
    }
  }
}

