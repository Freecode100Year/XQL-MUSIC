import { CacheEntry } from '../types';

// At most MAX_ENTRIES entries. A Map keeps insertion order, and get() moves
// an entry to the end, so the first entry is always the least recently used.
const MAX_ENTRIES = 300;

class RequestCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number): void {
    this.cache.delete(key);
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
    if (this.cache.size > MAX_ENTRIES) {
      this.cleanup();
      for (const oldest of this.cache.keys()) {
        if (this.cache.size <= MAX_ENTRIES) break;
        this.cache.delete(oldest);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

export const requestCache = new RequestCache();
