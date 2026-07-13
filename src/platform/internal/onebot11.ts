/**
 * OneBot11 事件到平台内部消息的转换。
 */

import { InternalMessage, InternalMessageType, InternalReply } from "./types";
import type { OneBotEvent as ProtocolOneBotEvent } from "../../adapter/protocol/onebot11";
import { buildMessageSegments, normalizeMessageSegments } from "./message-segments";

export type OneBotEvent = ProtocolOneBotEvent & Record<string, unknown>;

export function normalizeInternalMessage(
  event: OneBotEvent,
  messageType: InternalMessageType,
  isSelfSent: boolean,
  privatePeerId?: number
): InternalMessage | null {
  const messageId = Number(event.message_id);
  const userId = Number(event.user_id);
  const rawMessage = String(event.raw_message ?? "");
  if (!messageId || !userId) return null;

  const sender = event.sender as Record<string, unknown> | undefined;
  const groupId = event.group_id === undefined ? undefined : Number(event.group_id);
  const selfId = event.self_id === undefined ? undefined : Number(event.self_id);

  return {
    ...(event as unknown as InternalMessage),
    message_id: messageId,
    user_id: userId,
    group_id: groupId,
    self_id: selfId,
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

export function normalizeReply(rawReply: unknown, rawSegments?: unknown): InternalReply | null {
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

function normalizeSegmentReply(rawSegments: unknown): InternalReply | null {
  const segment = normalizeMessageSegments(rawSegments).find((item) => item.type === "reply");
  const data = segment?.data as Record<string, unknown> | undefined;
  const messageId = Number(data?.id ?? data?.message_id);
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
