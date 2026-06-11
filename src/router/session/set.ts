/**
 * Session 上下文写入 — 只操作 context.json
 * archive 写入由独立的 router/archive 模块负责
 */

import fs from "fs";
import path from "path";
import { sessionDir, ensureDir } from "./utils/storage";
import { StoredMessage } from "./utils/types";
import { logger } from "../../utils/logger";

// ====== 内存缓存 ======

const cache = new Map<string, StoredMessage[]>();

function cacheKey(sessionId: string, baseDir?: string): string {
  return baseDir ? `${baseDir}::${sessionId}` : sessionId;
}

export function getCache(sessionId: string, baseDir?: string): StoredMessage[] {
  const key = cacheKey(sessionId, baseDir);
  if (!cache.has(key)) {
    cache.set(key, load(sessionId, baseDir));
  }
  return cache.get(key)!;
}

// ====== 磁盘读写 ======

function load(sessionId: string, baseDir?: string): StoredMessage[] {
  try {
    const fp = path.join(sessionDir(sessionId, baseDir), "context.json");
    if (!fs.existsSync(fp)) return [];
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    logger.warn("上下文加载失败", { sessionId, error: String(err) });
    return [];
  }
}

function persist(sessionId: string, msgs: StoredMessage[], baseDir?: string): void {
  try {
    ensureDir(sessionId, baseDir);
    fs.writeFileSync(
      path.join(sessionDir(sessionId, baseDir), "context.json"),
      JSON.stringify(msgs, null, 2),
      "utf-8"
    );
  } catch (err) {
    logger.warn("上下文保存失败", { sessionId, error: String(err) });
  }
}

// ====== 对外接口 ======

/** 存入一条消息到 context.json。baseDir 仅 agentLoop 内部使用 */
export function set(sessionId: string, msg: StoredMessage, baseDir?: string): void {
  const msgs = getCache(sessionId, baseDir);
  msgs.push(msg);
  persist(sessionId, msgs, baseDir);
}
