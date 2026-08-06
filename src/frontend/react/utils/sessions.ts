/**
 * Debug Sessions 页面数据分组工具。
 */

import type { DebugSession } from "../types";

export function groupSessionsByPerson(sessions: DebugSession[]): Record<string, DebugSession[]> {
  return sessions.reduce<Record<string, DebugSession[]>>((groups, session) => {
    const personId = session.personId || session.userId || "unknown";
    if (!groups[personId]) groups[personId] = [];
    groups[personId].push(session);
    return groups;
  }, {});
}

export function sessionMessageCount(session: DebugSession): number {
  if (typeof session.totalMessageCount === "number") return session.totalMessageCount;
  if (typeof session.messageCount === "number") return session.messageCount;
  const actors = Array.isArray(session.actors) ? session.actors : [];
  return actors.reduce((total, actor) => total + (actor.messageCount ?? 0), 0);
}

export function sessionActiveMessageCount(session: DebugSession): number {
  if (typeof session.activeMessageCount === "number") return session.activeMessageCount;
  const actors = Array.isArray(session.actors) ? session.actors : [];
  return actors.reduce((total, actor) => total + (actor.activeMessageCount ?? actor.messageCount ?? 0), 0);
}
