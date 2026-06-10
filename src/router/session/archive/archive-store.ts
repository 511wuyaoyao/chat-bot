/**
 * Archive 存储 — 只追加，完整审计日志
 * 管理 archive.jsonl，直接存 StoredMessage
 */

import fs from "fs";
import path from "path";
import { sessionDir, ensureDir } from "../utils/storage";
import { StoredMessage } from "../utils/types";
import { logger } from "../../../utils/logger";

/** 追加一条消息到归档 */
export function set(sessionId: string, msg: StoredMessage): void {
  try {
    ensureDir(sessionId);
    fs.appendFileSync(
      path.join(sessionDir(sessionId), "archive.jsonl"),
      JSON.stringify(msg) + "\n",
      "utf-8"
    );
  } catch (err) {
    logger.warn("归档写入失败", { sessionId, error: String(err) });
  }
}

/** 读取全部归档消息 */
export function get(sessionId: string): StoredMessage[] {
  try {
    const fp = path.join(sessionDir(sessionId), "archive.jsonl");
    if (!fs.existsSync(fp)) return [];
    const raw = fs.readFileSync(fp, "utf-8").trim();
    if (!raw) return [];
    return raw.split("\n").map((line) => JSON.parse(line));
  } catch (err) {
    logger.warn("归档读取失败", { sessionId, error: String(err) });
    return [];
  }
}
