/**
 * Archive 存储路径 — 复用 sessionDir，archive 和 context 同目录不同文件
 */

import fs from "fs";
import { sessionDir } from "../../session/utils/storage";

export function archiveDir(sessionId: string): string {
  return sessionDir(sessionId);
}

export function ensureArchiveDir(sessionId: string): void {
  const d = archiveDir(sessionId);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
