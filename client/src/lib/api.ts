import { clearAllCache, getApiCacheKey, type CacheOptions, withCache } from './cache';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const API_URL = API_BASE_URL;

// Global handler for 401 errors
let onUnauthorized: (() => Promise<void> | void) | null = null;

export function setUnauthorizedHandler(handler: (() => Promise<void> | void) | null) {
  onUnauthorized = handler;
}

export type ApiOptions = {
  method?: string;
  body?: any;
  token?: string | null;
  headers?: Record<string, string>;
  cache?: CacheOptions;
};

// Helper to validate token format (basic JWT structure check)
function isValidTokenFormat(token: string): boolean {
  // JWT tokens have 3 parts separated by dots: header.payload.signature
  const parts = token.split('.');
  return parts.length === 3 && parts.every(part => part.length > 0);
}

// Helper to get the latest token from localStorage
// Always prefers localStorage token if available, as it may have been refreshed
// This is critical for long-running operations like imports where token might expire mid-operation
// Security: Validates token format before use, but server-side validation is the ultimate security measure
function getLatestToken(providedToken?: string | null): string | null {
  const storedToken = localStorage.getItem('token');
  
  // If we have a stored token, validate its format before using it
  if (storedToken) {
    if (!isValidTokenFormat(storedToken)) {
      // Invalid token format in localStorage - possible tampering or corruption
      // Clear it and fall back to provided token
      console.warn('Invalid token format in localStorage, clearing it');
      localStorage.removeItem('token');
      return providedToken || null;
    }
    // Valid format - prefer stored token (might have been refreshed)
    return storedToken;
  }
  
  // No stored token - use provided token if available
  if (providedToken && isValidTokenFormat(providedToken)) {
    return providedToken;
  }
  
  return null;
}

export async function api(
  path: string,
  { method = 'GET', body, token, headers = {}, cache }: ApiOptions = {}
) {
  const url = `${API_URL}/api${path}`;
  const methodUpper = method.toUpperCase();
  const cacheKey = cache?.key ?? getApiCacheKey(path);

  // Helper to perform a fetch with a specific token value
  const doFetch = async (authToken: string | null) => {
    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  const fetcher = async () => {
    // Always use the latest token from localStorage to handle refresh scenarios
    // This is especially important for long-running operations like imports
    let currentToken = getLatestToken(token);
    let res = await doFetch(currentToken);

    if (!res.ok && res.status === 401) {
      // Trigger global unauthorized handler (typically refresh session)
      if (onUnauthorized) {
        await onUnauthorized();
      }

      // Get the latest token again after refresh attempt
      const refreshedToken = getLatestToken(token);
      if (refreshedToken) {
        // Retry with refreshed token (even if same, in case refresh fixed the issue)
        res = await doFetch(refreshedToken);
      } else {
        // If no token available after refresh, the error from the original request will be thrown below
      }
    }

    if (!res.ok) {
      let msg = `Request failed (${res.status})`;
      try {
        const e = await res.json();
        msg = e.error || msg;
      } catch {
        // ignore JSON parse errors and fall back to default message
      }
      throw new Error(msg);
    }

    return res.json();
  };

  if (methodUpper === 'GET' && cache?.mode !== 'no-store') {
    return withCache(cacheKey, fetcher, cache);
  }

  const data = await fetcher();
  if (methodUpper !== 'GET') {
    clearAllCache();
  }
  return data;
}
