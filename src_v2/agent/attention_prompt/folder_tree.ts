/**
 * 目录树上下文
 * 调 file-engine.scanTree 获取用户数据目录树，30 秒缓存
 */

import { scanTree } from "../../../src/tools/data_tools/data_engine/file-engine";

interface CacheEntry {
  tree: string;
  ts: number;
}

const TREE_CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

export function folderTreeContext(userId: string): string {
  const entry = cache.get(userId);
  const now = Date.now();
  if (entry && now - entry.ts < TREE_CACHE_TTL_MS) {
    return entry.tree;
  }

  const tree = scanTree(userId);
  cache.set(userId, { tree, ts: now });
  return tree;
}
