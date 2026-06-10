/**
 * 上下文写入 + 会话生命周期
 * context.json: 全部消息（user / assistant / tool）
 * archive.jsonl: 全部消息（结构化归档）
 */

import fs from "fs";
import path from "path";
import { sessionDir, ensureDir } from "./utils/storage";
import { StoredMessage } from "./utils/types";
import * as archive from "./archive/archive-store";
import { logger } from "../../utils/logger";

// ====== 内存缓存 ======

const cache = new Map<string, StoredMessage[]>();

export function getCache(sessionId: string): StoredMessage[] {
  if (!cache.has(sessionId)) {
    cache.set(sessionId, load(sessionId));
  }
  return cache.get(sessionId)!;
}

// ====== 磁盘读写 ======

function load(sessionId: string): StoredMessage[] {
  try {
    const fp = path.join(sessionDir(sessionId), "context.json");
    if (!fs.existsSync(fp)) return [];
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch (err) {
    logger.warn("上下文加载失败", { sessionId, error: String(err) });
    return [];
  }
}

function persist(sessionId: string, msgs: StoredMessage[]): void {
  try {
    ensureDir(sessionId);
    fs.writeFileSync(
      path.join(sessionDir(sessionId), "context.json"),
      JSON.stringify(msgs, null, 2),
      "utf-8"
    );
  } catch (err) {
    logger.warn("上下文保存失败", { sessionId, error: String(err) });
  }
}

// ====== 对外接口 ======

/** 存入一条消息：全部进 context + archive */
export function set(sessionId: string, userId: string, msg: StoredMessage): void {
  const msgs = getCache(sessionId);
  msgs.push(msg);
  archive.set(sessionId, msg);
  persist(sessionId, msgs);
}
