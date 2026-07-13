/**
 * session 消息元数据定位逻辑，用于通过 QQ message_id 找到所属 session。
 */

import type { StoredMessage } from "./session/utils/types";

export interface SessionMessageMeta {
  sessionId: string;
  createdAt?: number;
  updatedAt?: number;
  messageIds?: string[];
  minMessageId?: number;
  maxMessageId?: number;
}

export function buildSessionMessageMeta(
  sessionId: string,
  messages: Pick<StoredMessage, "message_id" | "timestamp" | "role" | "content">[]
): SessionMessageMeta {
  const ids = Array.from(
    new Set(
      messages
        .map((item) => item.message_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  ).sort(compareMessageId);

  const numericIds = ids
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));

  const timestamps = messages
    .map((item) => item.timestamp)
    .filter((time): time is number => typeof time === "number" && Number.isFinite(time));

  return {
    sessionId,
    createdAt: timestamps.length > 0 ? Math.min(...timestamps) : undefined,
    updatedAt: timestamps.length > 0 ? Math.max(...timestamps) : undefined,
    messageIds: ids,
    minMessageId: numericIds.length > 0 ? Math.min(...numericIds) : undefined,
    maxMessageId: numericIds.length > 0 ? Math.max(...numericIds) : undefined,
  };
}

export function messageMetaContains(meta: SessionMessageMeta, messageId: number | string): boolean {
  const messageIdText = String(messageId);
  if (meta.messageIds) return meta.messageIds.includes(messageIdText);
  if (meta.minMessageId === undefined || meta.maxMessageId === undefined) return false;
  const numericMessageId = Number(messageId);
  return Number.isFinite(numericMessageId)
    && numericMessageId >= meta.minMessageId
    && numericMessageId <= meta.maxMessageId;
}

export function resolveSessionByMessageId(
  metas: SessionMessageMeta[],
  messageId: number | string
): SessionMessageMeta | undefined {
  const messageIdText = String(messageId);
  const exactMatches = metas
    .filter((meta) => meta.messageIds?.includes(messageIdText))
    .sort(compareMetaByUpdatedAtDesc);

  if (exactMatches.length > 0) return exactMatches[0];

  return metas
    .filter((meta) => messageMetaContains(meta, messageId))
    .sort(compareMetaByUpdatedAtDesc)[0];
}

function compareMetaByUpdatedAtDesc(a: SessionMessageMeta, b: SessionMessageMeta): number {
  return (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
}

function compareMessageId(a: string, b: string): number {
  const numericA = Number(a);
  const numericB = Number(b);
  if (Number.isFinite(numericA) && Number.isFinite(numericB)) return numericA - numericB;
  return a.localeCompare(b);
}
