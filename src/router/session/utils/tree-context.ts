/**
 * 树上下文构建器
 * 直接调 file-engine.scanTree 获取纯文本树，注入 AI 上下文
 * 带短 TTL 缓存，避免每次 get() 都扫描磁盘
 */

import { scanTree } from "../../../tools/data_tools/data_engine/file-engine";

interface CacheEntry {
  tree: string;
  ts: number;
}

const TREE_CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

/**
 * 构建当前用户的数据目录树上下文文本
 * 30 秒内重复调用走缓存，避免频繁磁盘 I/O
 * @returns 格式化的树文本，无数据时返回 ""
 */
export function buildTreeContext(userId: string): string {
  const entry = cache.get(userId);
  const now = Date.now();
  if (entry && now - entry.ts < TREE_CACHE_TTL_MS) {
    return entry.tree;
  }

  const tree = scanTree(userId);
  cache.set(userId, { tree, ts: now });
  return tree;
}
