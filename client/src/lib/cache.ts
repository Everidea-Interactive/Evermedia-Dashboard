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
const IDB_DB_NAME = 'evermedia_cache_db';
const IDB_STORE_NAME = 'entries';
const MAX_LOCALSTORAGE_BYTES = 512 * 1024; // 512KB per entry before falling back to IndexedDB

const memoryCache = new Map<string, CacheEntry<any>>();
const inflight = new Map<string, Promise<any>>();
let idbPromise: Promise<IDBDatabase> | null = null;

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

function canUseIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function getCacheDb(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('IndexedDB is not available'));
  }
  if (idbPromise) return idbPromise;
  idbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
  });
  return idbPromise;
}

async function readStoredEntryFromIdb<T>(storageKey: string): Promise<CacheEntry<T> | null> {
  try {
    const db = await getCacheDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.get(storageKey);
      request.onsuccess = () => resolve((request.result as CacheEntry<T> | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error('Failed to read IndexedDB'));
    });
  } catch {
    return null;
  }
}

async function writeStoredEntryToIdb<T>(storageKey: string, entry: CacheEntry<T>): Promise<void> {
  try {
    const db = await getCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(entry, storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to write IndexedDB'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  } catch {
    // ignore storage errors
  }
}

async function deleteStoredEntryFromIdb(storageKey: string): Promise<void> {
  try {
    const db = await getCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.delete(storageKey);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to delete IndexedDB entry'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  } catch {
    // ignore storage errors
  }
}

async function deleteStoredEntriesByPrefix(prefix: string): Promise<void> {
  if (!canUseIndexedDb() || typeof IDBKeyRange === 'undefined') return;
  try {
    const db = await getCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      const range = IDBKeyRange.bound(prefix, `${prefix}\uffff`);
      const request = store.openCursor(range);
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to iterate IndexedDB'));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  } catch {
    // ignore storage errors
  }
}

async function clearIdbEntries(): Promise<void> {
  if (!canUseIndexedDb()) return;
  try {
    const db = await getCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('Failed to clear IndexedDB'));
      tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
    });
  } catch {
    // ignore storage errors
  }
}

function estimateBytes(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length * 2;
}

function getEffectiveExpiresAt(entry: CacheEntry<any>, options: CacheOptions): number {
  const overrideExpiresAt =
    typeof options.ttlMs === 'number' ? entry.storedAt + options.ttlMs : entry.expiresAt;
  return Math.min(entry.expiresAt, overrideExpiresAt);
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

  const effectiveExpiresAt = getEffectiveExpiresAt(entry, options);

  if (now > effectiveExpiresAt) {
    memoryCache.delete(storageKey);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore storage errors
    }
    void deleteStoredEntryFromIdb(storageKey);
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
    const serialized = JSON.stringify(entry);
    if (estimateBytes(serialized) <= MAX_LOCALSTORAGE_BYTES) {
      localStorage.setItem(storageKey, serialized);
      void deleteStoredEntryFromIdb(storageKey);
      return;
    }
  } catch (error) {
    console.warn('Failed to persist cache entry:', error);
  }

  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore storage errors
  }
  void writeStoredEntryToIdb(storageKey, entry);
}

export function invalidateCache(key: string, options: CacheOptions = {}): void {
  const storageKey = buildStorageKey(key, options.scope);
  memoryCache.delete(storageKey);
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore storage errors
  }
  void deleteStoredEntryFromIdb(storageKey);
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
  void deleteStoredEntriesByPrefix(scopedPrefix);
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
  void clearIdbEntries();
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
    const stored = await readStoredEntryFromIdb<T>(storageKey);
    if (stored) {
      const effectiveExpiresAt = getEffectiveExpiresAt(stored, options);
      if (Date.now() > effectiveExpiresAt) {
        void deleteStoredEntryFromIdb(storageKey);
      } else {
        memoryCache.set(storageKey, stored);
        return stored.data as T;
      }
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
