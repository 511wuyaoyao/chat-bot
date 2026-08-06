/**
 * OneBot11 事件到平台内部消息的转换。
 */

import { InternalMessage, InternalMessageType, InternalReply } from "./types";
import type { OneBotEvent as ProtocolOneBotEvent, OneBotMessageEvent } from "../../adapter/protocol/onebot11";
import { buildMessageSegments, normalizeMessageSegments } from "./message-segments";

export type OneBotEvent = OneBotMessageEvent;

export function normalizeInternalMessage(
  event: OneBotEvent,
  messageType: InternalMessageType,
  isSelfSent: boolean,
  privatePeerId?: string | number
): InternalMessage | null {
  const messageId = Number(event.message_id);
  const userId = readId(event.user_id);
  const rawMessage = String(event.raw_message ?? "");
  if (!messageId || !userId) return null;

  const eventRecord = event as unknown as Record<string, unknown>;
  const sender = event.sender as unknown as Record<string, unknown> | undefined;
  const groupId = eventRecord.group_id === undefined ? undefined : readId(eventRecord.group_id);
  const selfId = event.self_id === undefined ? undefined : readId(event.self_id);

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
    reply: normalizeReply(eventRecord.reply, event.message),
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
  const userId = readId(sender?.user_id ?? reply.user_id);
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

export function getSelfSentPrivatePeerId(event: OneBotEvent, selfId: string): string | number | undefined {
  const peerId =
    readIdField(event, "target_id") ??
    readIdField(event, "peer_id") ??
    readIdField(event, "recipient_id") ??
    readIdField(event, "to_user_id") ??
    readIdField(event, "friend_id");

  if (peerId) return peerId;

  const userId = readIdField(event, "user_id");
  if (userId && String(userId) !== selfId) return userId;

  return undefined;
}

function readIdField(event: OneBotEvent, field: string): string | number | undefined {
  const value = (event as unknown as Record<string, unknown>)[field];
  return readId(value);
}

function readId(value: unknown): string | number | undefined {
  if (value === undefined || value === null || value === "") return undefined;

  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : undefined;
  const text = String(value).trim();
  if (!text) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed > 0 && String(parsed) === text ? parsed : text;
}
