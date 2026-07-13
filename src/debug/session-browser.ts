/**
 * Debug 会话浏览器
 * 只读扫描 data 目录下的用户 session，供调试页面快速查看上下文文件。
 */

import fs from "fs";
import path from "path";
import type { StoredMessage } from "../router/session/utils/types";
import { debugDetailCache } from "./detail-cache";

const DATA_ROOT = path.resolve(process.cwd(), "data");
const ACTORS = ["main", "topic", "exec"] as const;

export type DebugSessionActor = (typeof ACTORS)[number];

export interface DebugSessionActorSummary {
  actor: DebugSessionActor;
  messageCount: number | null;
  deletedCount: number | null;
  updatedAt: number | null;
  contextSize: number;
  contextPath: string;
}

export interface DebugSessionSummary {
  userId: string;
  sessionId: string;
  isCurrent: boolean;
  updatedAt: number | null;
  actors: DebugSessionActorSummary[];
}

export interface DebugSessionDetail extends DebugSessionActorSummary {
  userId: string;
  sessionId: string;
  messages: StoredMessage[];
}

function isSafeSegment(value: string): boolean {
  return /^[^/\\]+$/.test(value) && value !== "." && value !== "..";
}

function readContext(contextPath: string): StoredMessage[] {
  if (!fs.existsSync(contextPath)) return [];
  try {
    const raw = fs.readFileSync(contextPath, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as StoredMessage[]) : [];
  } catch {
    return [];
  }
}

function countContext(contextPath: string): { messageCount: number; deletedCount: number } {
  if (!fs.existsSync(contextPath)) return { messageCount: 0, deletedCount: 0 };
  try {
    const raw = fs.readFileSync(contextPath, "utf8");
    return {
      messageCount: raw.match(/"role"\s*:/g)?.length ?? 0,
      deletedCount: raw.match(/"deleted"\s*:\s*true/g)?.length ?? 0,
    };
  } catch {
    return { messageCount: 0, deletedCount: 0 };
  }
}

function fileUpdatedAt(filePath: string): number | null {
  if (!fs.existsSync(filePath)) return null;
  return fs.statSync(filePath).mtimeMs;
}

function fileSize(filePath: string): number {
  if (!fs.existsSync(filePath)) return 0;
  return fs.statSync(filePath).size;
}

function currentSessionId(userId: string): string | null {
  const filePath = path.join(DATA_ROOT, userId, "current-session.txt");
  if (!fs.existsSync(filePath)) return null;
  try {
    return fs.readFileSync(filePath, "utf8").trim() || null;
  } catch {
    return null;
  }
}

function actorSummary(actor: DebugSessionActor, actorDir: string): DebugSessionActorSummary | null {
  const contextPath = path.join(actorDir, "context.json");
  if (!fs.existsSync(contextPath)) return null;
  const counts = countContext(contextPath);
  return {
    actor,
    messageCount: counts.messageCount,
    deletedCount: counts.deletedCount,
    updatedAt: fileUpdatedAt(contextPath),
    contextSize: fileSize(contextPath),
    contextPath,
  };
}

function cacheVersion(summary: DebugSessionActorSummary): string {
  return `${summary.updatedAt ?? 0}:${summary.contextSize}`;
}

export function listDebugSessions(): DebugSessionSummary[] {
  if (!fs.existsSync(DATA_ROOT)) return [];

  const sessions: DebugSessionSummary[] = [];
  for (const userEntry of fs.readdirSync(DATA_ROOT, { withFileTypes: true })) {
    if (!userEntry.isDirectory()) continue;
    const userId = userEntry.name;
    const sessionRoot = path.join(DATA_ROOT, userId, "session");
    if (!fs.existsSync(sessionRoot)) continue;
    const current = currentSessionId(userId);

    for (const sessionEntry of fs.readdirSync(sessionRoot, { withFileTypes: true })) {
      if (!sessionEntry.isDirectory()) continue;
      const sessionId = sessionEntry.name;
      const sessionDir = path.join(sessionRoot, sessionId);
      const actors = ACTORS
        .map((actor) => actorSummary(actor, path.join(sessionDir, actor)))
        .filter((item): item is DebugSessionActorSummary => Boolean(item));
      if (actors.length === 0) continue;
      sessions.push({
        userId,
        sessionId,
        isCurrent: sessionId === current,
        updatedAt: actors.reduce<number | null>((latest, actor) => {
          if (actor.updatedAt === null) return latest;
          return latest === null ? actor.updatedAt : Math.max(latest, actor.updatedAt);
        }, null),
        actors,
      });
    }
  }

  return sessions.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
}

export function getDebugSessionDetail(
  userId: string,
  sessionId: string,
  actor: string
): DebugSessionDetail | null {
  if (!isSafeSegment(userId) || !isSafeSegment(sessionId)) return null;
  if (!ACTORS.includes(actor as DebugSessionActor)) return null;

  const typedActor = actor as DebugSessionActor;
  const actorDir = path.join(DATA_ROOT, userId, "session", sessionId, typedActor);
  const summary = actorSummary(typedActor, actorDir);
  if (!summary) return null;

  const key = `session:${userId}:${sessionId}:${typedActor}`;
  const version = cacheVersion(summary);
  const cached = debugDetailCache.get<DebugSessionDetail>(key, version);
  if (cached) return cached;

  const messages = readContext(summary.contextPath);
  const detail = {
    ...summary,
    userId,
    sessionId,
    messageCount: messages.length,
    deletedCount: messages.filter((m) => m.deleted === true).length,
    messages,
  };
  debugDetailCache.set(key, detail, version);
  return detail;
}
