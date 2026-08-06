/**
 * 数据目录索引：维护每个 person 当前活跃的会话 ID。
 * 持久化到 data/{personId}/current-session.txt，重启不丢失。
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const DATA_ROOT = path.resolve(process.cwd(), "data");

const sessions = new Map<string, string>();

function currentFile(personId: string): string {
  return path.join(DATA_ROOT, personId, "current-session.txt");
}

function loadCurrent(personId: string): string | null {
  try {
    const fp = currentFile(personId);
    if (!fs.existsSync(fp)) return null;
    return fs.readFileSync(fp, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

function saveCurrent(personId: string, sid: string): void {
  const fp = currentFile(personId);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, sid, "utf-8");
}

/** 创建根会话 ID：{personId}_{随机值}。 */
export function createSessionId(personId: string): string {
  return `${personId}_${crypto.randomBytes(6).toString("hex")}`;
}

/** 获取或创建当前 person 的活跃会话 ID。 */
export function getOrCreateSession(personId: string): string {
  if (sessions.has(personId)) return sessions.get(personId)!;

  const existing = loadCurrent(personId);
  const sid = existing ?? createSessionId(personId);
  sessions.set(personId, sid);

  if (!existing) saveCurrent(personId, sid);
  return sid;
}

/** 切换当前 person 的活跃会话。 */
export function switchSession(personId: string, sid: string): void {
  sessions.set(personId, sid);
  saveCurrent(personId, sid);
}

/** 只读查询当前 person 的活跃会话 ID。 */
export function activeSessionId(personId: string): string | undefined {
  return sessions.get(personId);
}
