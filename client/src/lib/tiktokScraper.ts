/**
 * TikTok Scraper API integration with retry logic
 */

const TIKTOK_SCRAPER_API_URL = import.meta.env.VITE_TIKTOK_SCRAPER_API_URL || '';

export interface TikTokEngagementData {
  url: string;
  video_id: string;
  views: number;
  likes: number;
  bookmarks: number;
  comments: number;
  shares: number;
  post_type: string;
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

/**
 * Scrape a single TikTok URL with retry logic
 */
export async function scrapeTikTokUrl(
  url: string,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<TikTokEngagementData> {
  if (!TIKTOK_SCRAPER_API_URL) {
    throw new Error('TikTok Scraper API URL is not configured. Please set VITE_TIKTOK_SCRAPER_API_URL environment variable.');
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(
        `${TIKTOK_SCRAPER_API_URL}/scrape?url=${encodeURIComponent(url)}&timeout=15.0&use_cache=false`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
        throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
      }

      const data: TikTokEngagementData = await response.json();
      return data;
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors (e.g., invalid URL format)
      if (error.message?.includes('Invalid URL') || error.message?.includes('400')) {
        throw error;
      }

      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Failed to scrape TikTok URL after retries');
}

/**
 * Scrape multiple TikTok URLs in batch with retry logic for failed URLs
 */
export async function scrapeTikTokUrlsBatch(
  urls: string[],
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<TikTokBatchResponse> {
  if (!TIKTOK_SCRAPER_API_URL) {
    throw new Error('TikTok Scraper API URL is not configured. Please set VITE_TIKTOK_SCRAPER_API_URL environment variable.');
  }

  if (urls.length === 0) {
    return {
      results: [],
      errors: [],
      total: 0,
      successful: 0,
      failed: 0,
    };
  }

  // Filter out invalid URLs
  const validUrls = urls.filter(url => {
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
      errors: urls.map(url => ({ error: 'Invalid URL format', url })),
      total: urls.length,
      successful: 0,
      failed: urls.length,
    };
  }

  // Process in batches of 100 (API limit)
  const batchSize = 100;
  const batches: string[][] = [];
  for (let i = 0; i < validUrls.length; i += batchSize) {
    batches.push(validUrls.slice(i, i + batchSize));
  }

  const allResults: TikTokEngagementData[] = [];
  const allErrors: TikTokScrapeError[] = [];

  for (const batch of batches) {
    try {
      // Build query string for batch request
      const queryParams = batch.map(url => `urls=${encodeURIComponent(url)}`).join('&');
      const response = await fetch(
        `${TIKTOK_SCRAPER_API_URL}/scrape/batch?${queryParams}&timeout=15.0&use_cache=false`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
        throw new Error(errorData.detail || errorData.error || `HTTP ${response.status}`);
      }

      const batchResponse: TikTokBatchResponse = await response.json();
      allResults.push(...batchResponse.results);
      allErrors.push(...batchResponse.errors);
    } catch (error: any) {
      // If batch fails, try individual URLs with retry
      for (const url of batch) {
        try {
          const result = await scrapeTikTokUrl(url, maxRetries, retryDelay);
          allResults.push(result);
        } catch (err: any) {
          allErrors.push({
            error: err.message || 'Failed to scrape',
            url,
          });
        }
      }
    }
  }

  // Retry failed URLs individually
  const failedUrls = allErrors.map(e => e.url);
  if (failedUrls.length > 0) {
    const retryResults: TikTokEngagementData[] = [];
    const retryErrors: TikTokScrapeError[] = [];

    for (const url of failedUrls) {
      try {
        const result = await scrapeTikTokUrl(url, maxRetries, retryDelay);
        retryResults.push(result);
        // Remove from errors
        const errorIndex = allErrors.findIndex(e => e.url === url);
        if (errorIndex !== -1) {
          allErrors.splice(errorIndex, 1);
        }
      } catch (err: any) {
        retryErrors.push({
          error: err.message || 'Failed to scrape after retries',
          url,
        });
      }
    }

    allResults.push(...retryResults);
    allErrors.push(...retryErrors);
  }

  return {
    results: allResults,
    errors: allErrors,
    total: urls.length,
    successful: allResults.length,
    failed: allErrors.length,
  };
}

/**
 * Check if a URL is a TikTok URL
 */
export function isTikTokUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.includes('tiktok.com') || urlObj.hostname.includes('vt.tiktok.com');
  } catch {
    return false;
  }
}

