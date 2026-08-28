import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'rsser_app_db';
const DB_VERSION = 2;

export interface CachedFeedEntry {
  url: string;
  data: any;
  timestamp: number;
}

export interface CachedCategoryItems {
  type: string;
  items: any[];
  timestamp: number;
}

export interface CachedFeedsList {
  type: string;
  feeds: any[];
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;
const memoryFallback = new Map<string, any>();

function getDatabase(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (!db.objectStoreNames.contains('feed_cache')) {
          db.createObjectStore('feed_cache', { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains('category_items')) {
          db.createObjectStore('category_items', { keyPath: 'type' });
        }
        if (!db.objectStoreNames.contains('category_feeds')) {
          db.createObjectStore('category_feeds', { keyPath: 'type' });
        }
        if (!db.objectStoreNames.contains('app_kv')) {
          db.createObjectStore('app_kv');
        }
      },
    }).catch((err) => {
      console.warn('[IndexedDB] Failed to initialize IndexedDB, using memory fallback:', err);
      return null as any;
    });
  }
  return dbPromise;
}

// -------------------------------------------------------------
// Feed Individual Cache
// -------------------------------------------------------------
export async function getCachedFeed(url: string, maxAgeMs = 15 * 60 * 1000): Promise<any | null> {
  try {
    const db = await getDatabase();
    if (!db) {
      const mem = memoryFallback.get(`feed_${url}`);
      if (mem && Date.now() - mem.timestamp < maxAgeMs) return mem.data;
      return null;
    }
    const entry: CachedFeedEntry | undefined = await db.get('feed_cache', url);
    if (entry && (Date.now() - entry.timestamp < maxAgeMs)) {
      return entry.data;
    }
    return null;
  } catch (err) {
    console.warn('[IndexedDB] getCachedFeed error:', err);
    return null;
  }
}

export async function setCachedFeed(url: string, data: any): Promise<void> {
  if (!url || !data) return;
  try {
    memoryFallback.set(`feed_${url}`, { data, timestamp: Date.now() });
    const db = await getDatabase();
    if (!db) return;
    await db.put('feed_cache', {
      url,
      data,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('[IndexedDB] setCachedFeed error:', err);
  }
}

// -------------------------------------------------------------
// Category Items Cache (e.g. 'all', 'news', 'radio', 'podcast', etc.)
// -------------------------------------------------------------
export async function getCachedCategoryItems(type: string): Promise<any[] | null> {
  try {
    const db = await getDatabase();
    if (!db) {
      const mem = memoryFallback.get(`cat_items_${type}`);
      return mem?.items || null;
    }
    const entry: CachedCategoryItems | undefined = await db.get('category_items', type);
    return entry?.items || null;
  } catch (err) {
    console.warn('[IndexedDB] getCachedCategoryItems error:', err);
    return null;
  }
}

export async function setCachedCategoryItems(type: string, items: any[]): Promise<void> {
  if (!type || !items) return;
  try {
    memoryFallback.set(`cat_items_${type}`, { items, timestamp: Date.now() });
    const db = await getDatabase();
    if (!db) return;
    await db.put('category_items', {
      type,
      items,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('[IndexedDB] setCachedCategoryItems error:', err);
  }
}

// -------------------------------------------------------------
// Category Feeds Cache (feed sources list)
// -------------------------------------------------------------
export async function getCachedCategoryFeeds(type: string): Promise<any[] | null> {
  try {
    const db = await getDatabase();
    if (!db) {
      const mem = memoryFallback.get(`cat_feeds_${type}`);
      return mem?.feeds || null;
    }
    const entry: CachedFeedsList | undefined = await db.get('category_feeds', type);
    return entry?.feeds || null;
  } catch (err) {
    console.warn('[IndexedDB] getCachedCategoryFeeds error:', err);
    return null;
  }
}

export async function setCachedCategoryFeeds(type: string, feeds: any[]): Promise<void> {
  if (!type || !feeds) return;
  try {
    memoryFallback.set(`cat_feeds_${type}`, { feeds, timestamp: Date.now() });
    const db = await getDatabase();
    if (!db) return;
    await db.put('category_feeds', {
      type,
      feeds,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('[IndexedDB] setCachedCategoryFeeds error:', err);
  }
}

// -------------------------------------------------------------
// Generic Key-Value Storage
// -------------------------------------------------------------
export async function getStorageItem<T = any>(key: string): Promise<T | null> {
  try {
    const db = await getDatabase();
    if (!db) return memoryFallback.get(`kv_${key}`) ?? null;
    const val = await db.get('app_kv', key);
    return val !== undefined ? val : null;
  } catch (err) {
    return memoryFallback.get(`kv_${key}`) ?? null;
  }
}

export async function setStorageItem(key: string, value: any): Promise<void> {
  try {
    memoryFallback.set(`kv_${key}`, value);
    const db = await getDatabase();
    if (!db) return;
    await db.put('app_kv', value, key);
  } catch (err) {
    console.warn('[IndexedDB] setStorageItem error:', err);
  }
}

export async function removeStorageItem(key: string): Promise<void> {
  try {
    memoryFallback.delete(`kv_${key}`);
    const db = await getDatabase();
    if (!db) return;
    await db.delete('app_kv', key);
  } catch (err) {
    console.warn('[IndexedDB] removeStorageItem error:', err);
  }
}

// Clear all cached feeds & items (e.g. on manual refresh or cache clear)
export async function clearFeedCaches(): Promise<void> {
  try {
    const db = await getDatabase();
    if (db) {
      await db.clear('feed_cache');
      await db.clear('category_items');
    }
    for (const key of memoryFallback.keys()) {
      if (key.startsWith('feed_') || key.startsWith('cat_items_')) {
        memoryFallback.delete(key);
      }
    }
    console.log('[IndexedDB] Feed and item caches cleared successfully.');
  } catch (err) {
    console.warn('[IndexedDB] Error clearing feed caches:', err);
  }
}
