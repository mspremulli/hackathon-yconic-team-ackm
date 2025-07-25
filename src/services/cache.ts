interface CacheItem<T> {
  value: T;
  expiry: number;
}

export class SimpleCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private defaultTTL: number;

  constructor(defaultTTLSeconds = 300) { // 5 minutes default
    this.defaultTTL = defaultTTLSeconds * 1000;
    
    // Clean up expired items every minute
    setInterval(() => this.cleanup(), 60000);
  }

  set(key: string, value: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds || this.defaultTTL / 1000) * 1000;
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttl
    });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) return null;
    
    if (Date.now() > item.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key);
      }
    }
  }

  size(): number {
    return this.cache.size;
  }
}

// Create caches for different purposes
export const sentimentCache = new SimpleCache<any>(600); // 10 minutes
export const socialDataCache = new SimpleCache<any>(300); // 5 minutes
export const analysisCache = new SimpleCache<any>(900); // 15 minutes