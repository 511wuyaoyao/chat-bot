/**
 * 会话存储路径工具
 * 默认路径：data/{userId}/session/{sessionId}
 * Agent 可通过 baseDir 写入 main/topic/exec 子目录。
 */

import fs from "fs";
import path from "path";

const DATA_ROOT = path.resolve(process.cwd(), "data");

/** 从 sessionId 提取 userId（格式：{userId}_xxx...） */
function userIdFrom(sessionId: string): string {
  const idx = sessionId.indexOf("_");
  return idx < 0 ? sessionId : sessionId.slice(0, idx);
}

export function sessionDir(sessionId: string, baseDir?: string): string {
  if (baseDir) return baseDir;
  return path.join(DATA_ROOT, userIdFrom(sessionId), "session", sessionId);
}

export function ensureDir(sessionId: string, baseDir?: string): void {
  const d = sessionDir(sessionId, baseDir);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
