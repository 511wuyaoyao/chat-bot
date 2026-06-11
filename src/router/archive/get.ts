/**
 * Archive 读取 — 从 archive.json 读取全部归档消息
 */

import fs from "fs";
import path from "path";
import { archiveDir } from "./utils/storage";
import { StoredMessage } from "../session/utils/types";
import { logger } from "../../utils/logger";

/** 读取全部归档消息 */
export function get(sessionId: string): StoredMessage[] {
  try {
    const fp = path.join(archiveDir(sessionId), "archive.json");
    if (!fs.existsSync(fp)) return [];
    const raw = fs.readFileSync(fp, "utf-8").trim();
    if (!raw) return [];
    return raw.split("\n").map((line) => JSON.parse(line));
  } catch (err) {
    logger.warn("归档读取失败", { sessionId, error: String(err) });
    return [];
  }
}
