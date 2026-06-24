/**
 * 数据目录索引 — 维护每个用户当前活跃的会话 ID
 * 持久化到 data/{userId}/current-session.txt，重启不丢失
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_ROOT = path.resolve(process.cwd(), "data");

// ====== 内存缓存 ======

const sessions = new Map<string, string>();

// ====== 磁盘持久化 ======

function currentFile(userId: string): string {
  return path.join(DATA_ROOT, userId, "current-session.txt");
}

function loadCurrent(userId: string): string | null {
  try {
    const fp = currentFile(userId);
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

function saveCurrent(userId: string, sid: string): void {
  const fp = currentFile(userId);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, sid, "utf-8");
}

// ====== 对外接口 ======

/** 创建根会话 ID：{userId}_{随机值} */
export function createSessionId(userId: string): string {
  return `${userId}_${crypto.randomBytes(6).toString("hex")}`;
}

/** 获取或创建当前活跃会话 ID */
export function getOrCreateSession(userId: string): string {
  if (sessions.has(userId)) return sessions.get(userId)!;

  const existing = loadCurrent(userId);
  const sid = existing ?? createSessionId(userId);
  sessions.set(userId, sid);

  if (!existing) saveCurrent(userId, sid);
  return sid;
}

/** 切换活跃会话 */
export function switchSession(userId: string, sid: string): void {
  sessions.set(userId, sid);
  saveCurrent(userId, sid);
}

/** 只读查询当前活跃会话 ID */
export function activeSessionId(userId: string): string | undefined {
  return sessions.get(userId);
}
