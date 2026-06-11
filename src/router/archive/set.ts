/**
 * Archive 写入 — 追加 archive.json（与 context.json 同目录）
 */

import fs from "fs";
import path from "path";
import { archiveDir, ensureArchiveDir } from "./utils/storage";
import { StoredMessage } from "../session/utils/types";
import { logger } from "../../utils/logger";

/** 追加一条消息到归档 */
export function set(sessionId: string, msg: StoredMessage): void {
  try {
    ensureArchiveDir(sessionId);
    fs.appendFileSync(
      path.join(archiveDir(sessionId), "archive.json"),
      JSON.stringify(msg) + "\n",
      "utf-8"
    );
  } catch (err) {
    logger.warn("归档写入失败", { sessionId, error: String(err) });
  }
}
