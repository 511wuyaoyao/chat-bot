/**
 * 会话存储路径工具
 * 存储路径：data/{userId}/session/{sessionId}
 */

import fs from "fs";
import path from "path";

const DATA_ROOT = path.resolve(process.cwd(), "data");

/** 从 sessionId 提取 userId（格式：{userId}_{timestamp}） */
function userIdFrom(sessionId: string): string {
  const idx = sessionId.indexOf("_");
  return idx < 0 ? sessionId : sessionId.slice(0, idx);
}

export function sessionDir(sessionId: string): string {
  return path.join(DATA_ROOT, userIdFrom(sessionId), "session", sessionId);
}

export function ensureDir(sessionId: string): void {
  const d = sessionDir(sessionId);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}
