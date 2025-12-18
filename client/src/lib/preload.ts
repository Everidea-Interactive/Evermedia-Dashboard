import { api } from './api';

type Campaign = {
  id: string;
};

const PRELOAD_PATHS = {
  campaigns: '/campaigns',
  campaignsEngagement: '/campaigns/all/engagement',
  campaignsActive: '/campaigns?status=ACTIVE',
  postsAll: '/posts/all',
  accounts: '/accounts',
  picsActive: '/pics?active=true',
  picsAll: '/pics',
};

export async function preloadAppData(token: string): Promise<void> {
  if (!token) return;

  const campaignsPromise = api(PRELOAD_PATHS.campaigns, { token, cache: { mode: 'default' } });
  const accountsPromise = api(PRELOAD_PATHS.accounts, { token, cache: { mode: 'default' } });
  const picsActivePromise = api(PRELOAD_PATHS.picsActive, { token, cache: { mode: 'default' } });

  const [campaignsResult] = await Promise.allSettled([campaignsPromise, accountsPromise, picsActivePromise]);
  const campaigns =
    campaignsResult.status === 'fulfilled' && Array.isArray(campaignsResult.value)
      ? (campaignsResult.value as Campaign[])
      : [];

  if (campaigns.length > 0) {
    const campaignIds = campaigns.map((campaign) => campaign.id).sort().join(',');
    void api(`/campaigns/kpis/batch?campaignIds=${campaignIds}&accountId=null`, {
      token,
      cache: { mode: 'default' },
    });
  }

  void api(PRELOAD_PATHS.campaignsEngagement, { token, cache: { mode: 'default' } });
  void api(PRELOAD_PATHS.picsAll, { token, cache: { mode: 'default' } });

  setTimeout(() => {
    void api(PRELOAD_PATHS.postsAll, { token, cache: { mode: 'default' } });
  }, 0);

  setTimeout(() => {
    const preloadAdsDashboard = async () => {
      const activeCampaigns = await api(PRELOAD_PATHS.campaignsActive, { token, cache: { mode: 'default' } }).catch(() => []);
      if (!Array.isArray(activeCampaigns) || activeCampaigns.length === 0) return;
      const kpiPromises = activeCampaigns.map((campaign: Campaign) =>
        api(`/campaigns/${campaign.id}/kpis`, { token, cache: { mode: 'default' } }).catch(() => [])
      );
      await Promise.allSettled(kpiPromises);
    };
    void preloadAdsDashboard();
  }, 0);
}
