/**
 * Debug 详情缓存
 * 按总字节预算保存最近打开的详情，超过预算时按 LRU 淘汰。
 */

import { config } from "../config";

interface CacheEntry {
  value: unknown;
  byteSize: number;
  version?: string;
}

export interface DebugDetailCacheStats {
  maxBytes: number;
  totalBytes: number;
  itemCount: number;
}

export interface DebugDetailCacheSetResult {
  stored: boolean;
  byteSize: number;
  skippedReason?: "over_budget";
}

export class DebugDetailCache {
  private readonly items = new Map<string, CacheEntry>();
  private totalBytes = 0;

  constructor(private readonly maxBytes: number) {}

  get<T>(key: string, version?: string): T | null {
    const item = this.items.get(key);
    if (!item) return null;
    if (version !== undefined && item.version !== version) {
      this.delete(key);
      return null;
    }
    this.items.delete(key);
    this.items.set(key, item);
    return item.value as T;
  }

  set(key: string, value: unknown, version?: string): DebugDetailCacheSetResult {
    const byteSize = Buffer.byteLength(JSON.stringify(value), "utf8");
    this.delete(key);

    if (this.maxBytes <= 0 || byteSize > this.maxBytes) {
      return { stored: false, byteSize, skippedReason: "over_budget" };
    }

    this.items.set(key, { value, byteSize, version });
    this.totalBytes += byteSize;
    this.trim();
    return { stored: true, byteSize };
  }

  delete(key: string): void {
    const item = this.items.get(key);
    if (!item) return;
    this.totalBytes -= item.byteSize;
    this.items.delete(key);
  }

  stats(): DebugDetailCacheStats {
    return {
      maxBytes: this.maxBytes,
      totalBytes: this.totalBytes,
      itemCount: this.items.size,
    };
  }

  private trim(): void {
    while (this.totalBytes > this.maxBytes) {
      const oldest = this.items.keys().next().value as string | undefined;
      if (!oldest) break;
      this.delete(oldest);
    }
  }
}

export const debugDetailCache = new DebugDetailCache(config.debug.detailCacheMaxBytes);
