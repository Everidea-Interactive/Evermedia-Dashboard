import { Router } from 'express';
import { supabase } from '../supabase.js';
import { recalculateKPIs, recalculateCampaignKPIs } from '../utils/kpiRecalculation.js';
import { isTikTokUrl, scrapeTikTokUrlsBatchWithOriginals } from '../utils/tiktokScraper.js';

const router = Router();

function isAuthorized(req: any) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true; // opt-in: if not set, allow but warn
  const headerSecret = req.headers['x-cron-secret'];
  return typeof headerSecret === 'string' && headerSecret === cronSecret;
}

router.post('/engagement-refresh', async (req, res) => {
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { dateFrom, dateTo, limit } = (req.body || {}) as {
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  };

  const scraperUrl = process.env.TIKTOK_SCRAPER_API_URL || process.env.VITE_TIKTOK_SCRAPER_API_URL;
  if (!scraperUrl) {
    return res.status(500).json({ error: 'TIKTOK_SCRAPER_API_URL is not configured on the server' });
  }

  let query = supabase.from('Post').select('*').not('contentLink', 'is', null);
  if (dateFrom) {
    const from = new Date(dateFrom);
    if (!Number.isNaN(from.getTime())) {
      query = query.gte('postDate', from.toISOString());
    }
  }
  if (dateTo) {
    const to = new Date(dateTo);
    if (!Number.isNaN(to.getTime())) {
      query = query.lte('postDate', to.toISOString());
    }
  }
  if (limit && Number.isFinite(limit)) {
    query = query.limit(Number(limit));
  }

  const { data: posts, error } = await query;
  if (error) {
    return res.status(500).json({ error: `Failed to fetch posts: ${error.message}` });
  }

  const tiktokPosts = (posts || []).filter((p: any) => isTikTokUrl(p.contentLink));
  if (tiktokPosts.length === 0) {
    return res.json({ updated: 0, total: 0, failures: [], scrapeErrors: [], message: 'No TikTok URLs found' });
  }

  const urls = tiktokPosts.map((p: any) => p.contentLink as string);
  const scrapeResult = await scrapeTikTokUrlsBatchWithOriginals(urls, 1000);

  const engagementMap = new Map<string, any>();
  scrapeResult.results.forEach((r) => {
    engagementMap.set(r.originalUrl, r.data);
    if (r.resolvedUrl !== r.originalUrl) {
      engagementMap.set(r.resolvedUrl, r.data);
    }
  });

  let updated = 0;
  const failures: { postId: string; url: string; reason: string }[] = [];
  const campaignIds = new Set<string>();
  const accountPairs = new Set<string>(); // `${campaignId}:${accountId}`

  for (const post of tiktokPosts) {
    const engagement = engagementMap.get(post.contentLink);
    if (!engagement) {
      failures.push({
        postId: post.id,
        url: post.contentLink,
        reason: 'No engagement data returned',
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from('Post')
      .update({
        totalView: engagement.views ?? 0,
        totalLike: engagement.likes ?? 0,
        totalComment: engagement.comments ?? 0,
        totalShare: engagement.shares ?? 0,
        totalSaved: engagement.bookmarks ?? 0,
        postType: engagement.post_type ?? null,
      })
      .eq('id', post.id);

    if (updateError) {
      failures.push({
        postId: post.id,
        url: post.contentLink,
        reason: updateError.message || 'Failed to update post',
      });
      continue;
    }

    updated++;
    if (post.campaignId) {
      campaignIds.add(post.campaignId);
      if (post.accountId) {
        accountPairs.add(`${post.campaignId}:${post.accountId}`);
      }
    }
  }

  // Recalculate KPIs for affected accounts and campaigns (best-effort)
  for (const pair of accountPairs) {
    const [campaignId, accountId] = pair.split(':');
    try {
      await recalculateKPIs(campaignId, accountId);
    } catch (err) {
      console.error(`Failed to recalc KPIs for campaign ${campaignId} account ${accountId}:`, err);
    }
  }
  for (const campaignId of campaignIds) {
    try {
      await recalculateCampaignKPIs(campaignId);
    } catch (err) {
      console.error(`Failed to recalc campaign KPIs for ${campaignId}:`, err);
    }
  }

  res.json({
    updated,
    total: tiktokPosts.length,
    failures,
    scrapeErrors: scrapeResult.errors,
    successfulScrapes: scrapeResult.results.length,
    failedScrapes: scrapeResult.errors.length,
  });
});

export default router;
