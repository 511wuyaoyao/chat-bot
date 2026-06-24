/**
 * Archive 写入 — archive.json 使用 JSON 数组格式（与 context.json 一致）
 */

import fs from "fs";
import path from "path";
import { archiveDir, ensureArchiveDir } from "./utils/storage";
import { StoredMessage } from "../session/utils/types";
import { logger } from "../../utils/logger";

let _idSeq = 0;

function load(sessionId: string): StoredMessage[] {
  const fp = path.join(archiveDir(sessionId), "archive.json");
  if (!fs.existsSync(fp)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function persist(sessionId: string, msgs: StoredMessage[]): void {
  ensureArchiveDir(sessionId);
  fs.writeFileSync(
    path.join(archiveDir(sessionId), "archive.json"),
    JSON.stringify(msgs, null, 2),
    "utf-8"
  );
}

/** 追加一条消息到归档，自动注入 id + timestamp */
export function set(sessionId: string, msg: StoredMessage): void {
  try {
    const msgs = load(sessionId);
    const enriched: StoredMessage = {
      ...msg,
      id: msg.id || `${Date.now()}_${++_idSeq}`,
      timestamp: msg.timestamp || Date.now(),
    };
    msgs.push(enriched);
    persist(sessionId, msgs);
  } catch (err) {
    logger.warn("归档写入失败", { sessionId, error: String(err) });
  }
}
