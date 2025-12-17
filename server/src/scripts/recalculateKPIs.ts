import 'dotenv/config';
import { supabase } from '../supabase.js';
import { recalculateKPIs, recalculateCampaignKPIs } from '../utils/kpiRecalculation.js';

/**
 * Command-line script to recalculate KPIs
 * 
 * Usage:
 *   npm run recalculate-kpis                    # Recalculate all campaigns
 *   npm run recalculate-kpis -- --campaign=id   # Recalculate specific campaign
 *   npm run recalculate-kpis -- --account=id    # Recalculate specific account in all campaigns
 *   npm run recalculate-kpis -- --campaign=id --account=id  # Recalculate specific account in specific campaign
 */

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const campaignId = args.find(arg => arg.startsWith('--campaign='))?.split('=')[1];
  const accountId = args.find(arg => arg.startsWith('--account='))?.split('=')[1];

  try {
    if (campaignId && accountId) {
      // Recalculate for specific account in specific campaign
      console.log(`Recalculating KPIs for account ${accountId} in campaign ${campaignId}...`);
      await recalculateKPIs(campaignId, accountId);
      // Also recalculate campaign-level KPIs since account changes affect campaign totals
      await recalculateCampaignKPIs(campaignId);
      console.log(`✓ Successfully recalculated KPIs for account ${accountId} and campaign-level KPIs in campaign ${campaignId}`);
    } else if (campaignId) {
      // Recalculate all accounts in specific campaign
      console.log(`Recalculating KPIs for campaign ${campaignId}...`);
      
      // Get all accounts linked to this campaign
      const { data: accountLinks, error: linksError } = await supabase
        .from('_CampaignToAccount')
        .select('B')
        .eq('A', campaignId);
      
      if (linksError) {
        throw new Error(`Failed to fetch account links: ${linksError.message}`);
      }
      
      const accountIds = [...new Set((accountLinks || []).map((link: any) => link.B))];
      
      // Recalculate campaign-level KPIs
      await recalculateCampaignKPIs(campaignId);
      console.log(`✓ Recalculated campaign-level KPIs`);
      
      // Recalculate account-level KPIs
      for (const accId of accountIds) {
        await recalculateKPIs(campaignId, accId);
        console.log(`✓ Recalculated KPIs for account ${accId}`);
      }
      
      console.log(`✓ Successfully recalculated KPIs for campaign ${campaignId} (${accountIds.length} accounts)`);
    } else if (accountId) {
      // Recalculate specific account in all campaigns
      console.log(`Recalculating KPIs for account ${accountId} in all campaigns...`);
      
      // Get all campaigns linked to this account
      const { data: campaignLinks, error: linksError } = await supabase
        .from('_CampaignToAccount')
        .select('A')
        .eq('B', accountId);
      
      if (linksError) {
        throw new Error(`Failed to fetch campaign links: ${linksError.message}`);
      }
      
      const campaignIds = [...new Set((campaignLinks || []).map((link: any) => link.A))];
      
      for (const campId of campaignIds) {
        await recalculateKPIs(campId, accountId);
        // Also recalculate campaign-level KPIs since account changes affect campaign totals
        await recalculateCampaignKPIs(campId);
        console.log(`✓ Recalculated KPIs for account ${accountId} and campaign-level KPIs in campaign ${campId}`);
      }
      
      console.log(`✓ Successfully recalculated KPIs for account ${accountId} (${campaignIds.length} campaigns)`);
    } else {
      // Recalculate all campaigns
      console.log('Recalculating KPIs for all campaigns...');
      
      // Get all campaigns
      const { data: campaigns, error: campaignsError } = await supabase
        .from('Campaign')
        .select('id');
      
      if (campaignsError) {
        throw new Error(`Failed to fetch campaigns: ${campaignsError.message}`);
      }
      
      if (!campaigns || campaigns.length === 0) {
        console.log('No campaigns found.');
        return;
      }
      
      for (const campaign of campaigns) {
        const campId = campaign.id;
        
        // Get all accounts linked to this campaign
        const { data: accountLinks, error: linksError } = await supabase
          .from('_CampaignToAccount')
          .select('B')
          .eq('A', campId);
        
        if (linksError) {
          console.error(`Failed to fetch account links for campaign ${campId}: ${linksError.message}`);
          continue;
        }
        
        const accountIds = [...new Set((accountLinks || []).map((link: any) => link.B))];
        
        // Recalculate campaign-level KPIs
        await recalculateCampaignKPIs(campId);
        
        // Recalculate account-level KPIs
        for (const accId of accountIds) {
          await recalculateKPIs(campId, accId);
        }
        
        console.log(`✓ Recalculated KPIs for campaign ${campId} (${accountIds.length} accounts)`);
      }
      
      console.log(`✓ Successfully recalculated KPIs for all campaigns (${campaigns.length} campaigns)`);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();

