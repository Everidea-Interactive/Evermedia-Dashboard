/**
 * TikTok Scraper API integration for server-side jobs
 * Mirrors the client helper but uses server env vars.
 */

const TIKTOK_SCRAPER_API_URL =
  process.env.TIKTOK_SCRAPER_API_URL || process.env.VITE_TIKTOK_SCRAPER_API_URL || '';

export interface TikTokEngagementData {
  url: string; // resolved/expanded URL from TikTok
  video_id: string;
  views: number;
  likes: number;
  bookmarks: number;
  comments: number;
  shares: number;
  post_type: string;
}

export interface TikTokScrapeResultWithOriginal {
  originalUrl: string;
  resolvedUrl: string;
  data: TikTokEngagementData;
}

export interface TikTokScrapeError {
  error: string;
  url: string;
}

export interface TikTokBatchResponse {
  results: TikTokEngagementData[];
  errors: TikTokScrapeError[];
  total: number;
  successful: number;
  failed: number;
}

export interface TikTokBatchResponseWithOriginals {
  results: TikTokScrapeResultWithOriginal[];
  errors: TikTokScrapeError[];
  total: number;
  successful: number;
  failed: number;
}

export function isTikTokUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('tiktok.com') || urlObj.hostname.includes('vt.tiktok.com');
  } catch {
    return false;
  }
}

async function scrapeTikTokUrl(
  url: string,
  maxRetries: number = 1,
  retryDelay: number = 1000
): Promise<TikTokEngagementData> {
  if (!TIKTOK_SCRAPER_API_URL) {
    throw new Error('TikTok Scraper API URL is not configured. Set TIKTOK_SCRAPER_API_URL.');
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `${TIKTOK_SCRAPER_API_URL}/scrape?url=${encodeURIComponent(url)}&timeout=15.0&use_cache=false`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
        throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
      }

      return (await response.json()) as TikTokEngagementData;
    } catch (error: any) {
      lastError = error;

      if (error.message?.includes('Invalid URL') || error.message?.includes('400')) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to scrape TikTok URL after retries');
}

export async function scrapeTikTokUrlsBatchWithOriginals(
  urls: string[],
  retryDelay: number = 1000
): Promise<TikTokBatchResponseWithOriginals> {
  if (!TIKTOK_SCRAPER_API_URL) {
    throw new Error('TikTok Scraper API URL is not configured. Set TIKTOK_SCRAPER_API_URL.');
  }

  if (urls.length === 0) {
    return { results: [], errors: [], total: 0, successful: 0, failed: 0 };
  }

  const validUrls = urls.filter((url) => {
    try {
      new URL(url);
      return url.includes('tiktok.com') || url.includes('vt.tiktok.com');
    } catch {
      return false;
    }
  });

  if (validUrls.length === 0) {
    return {
      results: [],
      errors: urls.map((url) => ({ error: 'Invalid URL format', url })),
      total: urls.length,
      successful: 0,
      failed: urls.length,
    };
  }

  const batchSize = 100;
  const batches: string[][] = [];
  for (let i = 0; i < validUrls.length; i += batchSize) {
    batches.push(validUrls.slice(i, i + batchSize));
  }

  const allResults: TikTokScrapeResultWithOriginal[] = [];
  const allErrors: TikTokScrapeError[] = [];

  for (const batch of batches) {
    try {
      const response = await fetch(`${TIKTOK_SCRAPER_API_URL}/scrape/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: batch, timeout: 15.0, use_cache: false }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
        throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
      }

      const batchResponse = (await response.json()) as TikTokBatchResponse;
      const errorUrls = new Set(batchResponse.errors.map((e) => e.url));
      let resultIndex = 0;

      batch.forEach((originalUrl) => {
        if (errorUrls.has(originalUrl)) return;
        if (resultIndex < batchResponse.results.length) {
          const result = batchResponse.results[resultIndex];
          allResults.push({
            originalUrl,
            resolvedUrl: result.url,
            data: result,
          });
          resultIndex++;
        }
      });

      allErrors.push(...batchResponse.errors);
    } catch (error: any) {
      for (const originalUrl of batch) {
        try {
          const result = await scrapeTikTokUrl(originalUrl, 1, retryDelay);
          allResults.push({
            originalUrl,
            resolvedUrl: result.url,
            data: result,
          });
        } catch (err: any) {
          allErrors.push({
            error: err.message || 'Failed to scrape',
            url: originalUrl,
          });
        }
      }
    }
  }

  return {
    results: allResults,
    errors: allErrors,
    total: urls.length,
    successful: allResults.length,
    failed: allErrors.length,
  };
}
