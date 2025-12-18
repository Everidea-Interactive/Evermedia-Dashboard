export type CacheMode = 'default' | 'reload' | 'no-store';

export type CacheOptions = {
  key?: string;
  ttlMs?: number;
  mode?: CacheMode;
  scope?: string;
};

type CacheEntry<T> = {
  data: T;
  storedAt: number;
  expiresAt: number;
  ttlMs: number;
};

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_PREFIX = 'evermedia_cache';
const CACHE_VERSION = 1;

const memoryCache = new Map<string, CacheEntry<any>>();
const inflight = new Map<string, Promise<any>>();

function resolveScope(scope?: string): string {
  if (scope) return scope;
  try {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) return 'anon';
    const parsed = JSON.parse(storedUser);
    return parsed?.id ? String(parsed.id) : 'anon';
  } catch {
    return 'anon';
  }
}

function buildStorageKey(key: string, scope?: string): string {
  return `${CACHE_PREFIX}:v${CACHE_VERSION}:${resolveScope(scope)}:${key}`;
}

export function getApiCacheKey(path: string): string {
  return `api:${path}`;
}

function readStoredEntry<T>(storageKey: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed || typeof parsed.expiresAt !== 'number' || typeof parsed.storedAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getCachedValue<T>(key: string, options: CacheOptions = {}): T | null {
  const storageKey = buildStorageKey(key, options.scope);
  const now = Date.now();
  const entry = memoryCache.get(storageKey) ?? readStoredEntry<T>(storageKey);

  if (!entry) return null;

  const overrideExpiresAt =
    typeof options.ttlMs === 'number' ? entry.storedAt + options.ttlMs : entry.expiresAt;
  const effectiveExpiresAt = Math.min(entry.expiresAt, overrideExpiresAt);

  if (now > effectiveExpiresAt) {
    memoryCache.delete(storageKey);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore storage errors
    }
    return null;
  }

  if (!memoryCache.has(storageKey)) {
    memoryCache.set(storageKey, entry);
  }

  return entry.data as T;
}

export function setCachedValue<T>(key: string, data: T, options: CacheOptions = {}): void {
  const storageKey = buildStorageKey(key, options.scope);
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  const storedAt = Date.now();
  const entry: CacheEntry<T> = {
    data,
    storedAt,
    expiresAt: storedAt + ttlMs,
    ttlMs,
  };

  memoryCache.set(storageKey, entry);
  try {
    localStorage.setItem(storageKey, JSON.stringify(entry));
  } catch (error) {
    console.warn('Failed to persist cache entry:', error);
  }
}

export function invalidateCache(key: string, options: CacheOptions = {}): void {
  const storageKey = buildStorageKey(key, options.scope);
  memoryCache.delete(storageKey);
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore storage errors
  }
}

export function invalidateCacheByPrefix(prefix: string, options: CacheOptions = {}): void {
  const scopedPrefix = `${CACHE_PREFIX}:v${CACHE_VERSION}:${resolveScope(options.scope)}:${prefix}`;
  for (const key of memoryCache.keys()) {
    if (key.startsWith(scopedPrefix)) {
      memoryCache.delete(key);
    }
  }

  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(scopedPrefix)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export function clearAllCache(): void {
  memoryCache.clear();
  inflight.clear();
  try {
    for (let i = localStorage.length - 1; i >= 0; i -= 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${CACHE_PREFIX}:`)) {
        localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage errors
  }
}

export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const mode = options.mode ?? 'default';
  const storageKey = buildStorageKey(key, options.scope);

  if (mode === 'default') {
    const cached = getCachedValue<T>(key, options);
    if (cached !== null) {
      return cached;
    }
  } else if (mode === 'no-store') {
    return fetcher();
  }

  const existing = inflight.get(storageKey) as Promise<T> | undefined;
  if (existing) return existing;

  const promise = fetcher()
    .then((data) => {
      setCachedValue(key, data, options);
      return data;
    })
    .finally(() => {
      inflight.delete(storageKey);
    });

  inflight.set(storageKey, promise);
  return promise;
}
