/**
 * QQ 事件规范化
 * 将 NapCat/OneBot 原始事件转换为适配层统一的 QqMessage 结构。
 */

import { QqMessage, QqMessageType, QqReply } from "../interface";
import { buildMessageSegments, normalizeMessageSegments } from "../message-pipeline/message-segments";

export type OneBotEvent = Record<string, unknown>;

export function normalizeQqMessage(
  event: OneBotEvent,
  messageType: QqMessageType,
  isSelfSent: boolean,
  privatePeerId?: number
): QqMessage | null {
  const messageId = Number(event.message_id);
  const userId = Number(event.user_id);
  const rawMessage = String(event.raw_message ?? "");
  if (!messageId || !userId) return null;

  const sender = event.sender as Record<string, unknown> | undefined;
  const groupId = event.group_id === undefined ? undefined : Number(event.group_id);

  return {
    ...(event as unknown as QqMessage),
    message_id: messageId,
    user_id: userId,
    group_id: groupId,
    message_type: messageType,
    raw_message: rawMessage,
    original_raw_message: rawMessage,
    sender: {
      nickname: String(sender?.nickname ?? ""),
      card: String(sender?.card ?? ""),
    },
    reply: normalizeReply(event.reply, event.message),
    is_self_sent: isSelfSent,
    private_peer_id: privatePeerId,
  };
}

export function normalizeReply(rawReply: unknown, rawSegments?: unknown): QqReply | null {
  const segmentReply = normalizeSegmentReply(rawSegments);
  if (!rawReply || typeof rawReply !== "object") return segmentReply;

  const reply = rawReply as Record<string, unknown>;
  const sender = reply.sender as Record<string, unknown> | undefined;
  const messageId = Number(reply.message_id);
  const userId = Number(sender?.user_id ?? reply.user_id);
  if (!messageId || !userId) return null;

  const rawMessage = String(reply.raw_message ?? "");

  return {
    message_id: messageId,
    user_id: userId,
    raw_message: rawMessage,
    raw_segments: Array.isArray(reply.message)
      ? reply.message
      : buildMessageSegments(rawMessage),
  };
}

function normalizeSegmentReply(rawSegments: unknown): QqReply | null {
  const segment = normalizeMessageSegments(rawSegments).find((item) => item.type === "reply");
  const messageId = Number(segment?.data?.id ?? segment?.data?.message_id);
  if (!messageId) return null;

  return {
    message_id: messageId,
    user_id: 0,
    raw_message: "",
    raw_segments: [],
  };
}

export function getSelfSentPrivatePeerId(event: OneBotEvent, selfId: string): number | undefined {
  const peerId =
    readNumericField(event, "target_id") ??
    readNumericField(event, "peer_id") ??
    readNumericField(event, "recipient_id") ??
    readNumericField(event, "to_user_id") ??
    readNumericField(event, "friend_id");

  if (peerId) return peerId;

  const userId = readNumericField(event, "user_id");
  if (userId && String(userId) !== selfId) return userId;

  return undefined;
}

function readNumericField(event: OneBotEvent, field: string): number | undefined {
  const value = event[field];
  if (value === undefined || value === null || value === "") return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
