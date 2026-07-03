/**
 * QQ 消息段工具
 * 统一解析 OneBot 消息段并提供 @ 自身检测与开头 @ 清洗。
 */

import { OneBotMessageSegment } from "./types";

export function normalizeMessageSegments(rawSegments: unknown): OneBotMessageSegment[] {
  if (!Array.isArray(rawSegments)) return [];

  return rawSegments
    .filter((segment): segment is Record<string, unknown> => Boolean(segment) && typeof segment === "object")
    .map((segment) => ({
      type: typeof segment.type === "string" ? segment.type : undefined,
      data: segment.data && typeof segment.data === "object"
        ? segment.data as Record<string, unknown>
        : undefined,
    }));
}

export function isMentioningSelf(rawMessage: string, rawSegments: unknown, selfId: string): boolean {
  if (!selfId) return false;

  const segments = normalizeMessageSegments(rawSegments);
  if (segments.some((segment) => segment.type === "at" && isSelfAtValue(segment.data?.qq, selfId))) {
    return true;
  }

  return rawMessage.includes(`[CQ:at,qq=${selfId}]`) ||
    rawMessage.includes("[CQ:at,qq=self]");
}

export function stripLeadingSelfMention(rawMessage: string, rawSegments: unknown, selfId: string): string {
  if (!selfId) return rawMessage.trim();

  let cleaned = rawMessage.replace(/^\s*(?:\[reply\]\s*)+/i, "");
  cleaned = cleaned.replace(
    new RegExp(`^\\s*(?:\\[CQ:at,qq=${escapeRegExp(selfId)}[^\\]]*\\]\\s*)+`),
    ""
  );
  cleaned = cleaned.replace(
    /^\s*(?:\[CQ:at,qq=self[^\]]*\]\s*)+/,
    ""
  );

  for (const name of getLeadingSelfMentionNames(rawSegments, selfId)) {
    cleaned = cleaned.replace(new RegExp(`^\\s*@${escapeRegExp(name)}\\s*`), "");
  }

  return cleaned.trim();
}

export function buildMessageSegments(rawMessage: string, rawSegments?: unknown): OneBotMessageSegment[] {
  const normalizedRawMessage = rawMessage.trim();
  const normalizedRawSegments = normalizeMessageSegments(rawSegments);
  const contentSegments = normalizedRawSegments.filter((segment) => segment.type !== "reply");
  if (contentSegments.some((segment) => segment.type && segment.type !== "text")) {
    return contentSegments;
  }

  const cqSegments = parseCqMessageSegments(normalizedRawMessage);
  if (cqSegments.length > 0) return cqSegments;

  if (normalizedRawMessage) {
    return [{ type: "text", data: { text: normalizedRawMessage } }];
  }

  return contentSegments;
}

function parseCqMessageSegments(rawMessage: string): OneBotMessageSegment[] {
  const segments: OneBotMessageSegment[] = [];
  const cqPattern = /\[CQ:([a-zA-Z0-9_-]+),([^\]]*)\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = cqPattern.exec(rawMessage)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        data: { text: rawMessage.slice(lastIndex, match.index) },
      });
    }

    segments.push({
      type: match[1],
      data: parseCqData(match[2]),
    });
    lastIndex = cqPattern.lastIndex;
  }

  if (segments.length === 0) return [];

  if (lastIndex < rawMessage.length) {
    segments.push({
      type: "text",
      data: { text: rawMessage.slice(lastIndex) },
    });
  }

  return segments;
}

function parseCqData(rawData: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const item of rawData.split(",")) {
    const splitIndex = item.indexOf("=");
    if (splitIndex <= 0) continue;

    const key = item.slice(0, splitIndex);
    const value = item.slice(splitIndex + 1);
    data[key] = decodeCqValue(value);
  }
  return data;
}

function decodeCqValue(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#44;/g, ",")
    .replace(/&#91;/g, "[")
    .replace(/&#93;/g, "]");
}

function getLeadingSelfMentionNames(rawSegments: unknown, selfId: string): string[] {
  const names: string[] = [];
  for (const segment of normalizeMessageSegments(rawSegments)) {
    if (segment.type === "reply") continue;
    if (segment.type === "text" && !String(segment.data?.text ?? "").trim()) continue;
    if (segment.type !== "at" || !isSelfAtValue(segment.data?.qq, selfId)) break;

    for (const key of ["name", "nickname", "display"]) {
      const value = segment.data?.[key];
      if (typeof value === "string" && value.trim()) names.push(value.trim());
    }
  }
  return names;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSelfAtValue(value: unknown, selfId: string): boolean {
  const qq = String(value ?? "");
  return qq === selfId || qq === "self";
}
