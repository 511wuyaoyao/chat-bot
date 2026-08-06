/**
 * QQ 官方机器人原始事件到 OneBot11 消息事件的转换。
 */

import type { OneBot11IncomingEvent } from "../../protocol/onebot11";
import type { OneBotMessageSegment } from "../../protocol/onebot11";
import type { QQBotMessageEvent, QQBotWebhookPayload } from "./types";

const QQBOT_REFERENCE_MESSAGE_TYPE = 103;
const MAX_INDEXED_MESSAGES = 1000;
const indexedMessages = new Map<string, IndexedQQBotMessage>();
const officialMessageIdsByOneBotMessageId = new Map<number, string>();

interface IndexedQQBotMessage {
  message_id: number;
  user_id: string;
  raw_message: string;
  message: OneBotMessageSegment[];
}

export function qqBotRawEventToOneBot11(payload: QQBotWebhookPayload): OneBot11IncomingEvent | null {
  const eventType = payload.t;
  const data = payload.d;
  if (!eventType || !data) return null;

  if (eventType === "C2C_MESSAGE_CREATE") return toPrivateMessage(data, payload);
  if (eventType === "GROUP_AT_MESSAGE_CREATE") return toGroupMessage(data, payload);

  return null;
}

function toPrivateMessage(data: QQBotMessageEvent, payload: QQBotWebhookPayload): OneBot11IncomingEvent | null {
  const userOpenid = getUserOpenid(data);
  if (!userOpenid) return null;

  const rawMessage = normalizeContent(data.content) || renderMsgElementsText(data.msg_elements);
  const messageId = stableMessageId(data, payload);
  const reply = buildOneBotReply(data);
  const message = buildOneBotMessage(data, rawMessage, reply?.message_id);
  const event = {
    time: toUnixSeconds(data.timestamp),
    self_id: 0,
    post_type: "message",
    message_type: "private",
    sub_type: "friend",
    message_id: messageId,
    user_id: userOpenid,
    message,
    raw_message: rawMessage,
    font: 0,
    sender: {
      user_id: userOpenid,
      nickname: data.author?.username ?? "",
      sex: "unknown",
      age: 0,
    },
    ...(reply ? { reply } : {}),
  } as unknown as OneBot11IncomingEvent;
  rememberIndexedMessage(data, messageId, userOpenid, rawMessage, message);
  return event;
}

function toGroupMessage(data: QQBotMessageEvent, payload: QQBotWebhookPayload): OneBot11IncomingEvent | null {
  const groupOpenid = data.group_openid;
  const userOpenid = getUserOpenid(data);
  if (!groupOpenid || !userOpenid) return null;

  const rawMessage = normalizeContent(data.content) || renderMsgElementsText(data.msg_elements);
  const messageId = stableMessageId(data, payload);
  const reply = buildOneBotReply(data);
  const message = buildOneBotMessage(data, rawMessage, reply?.message_id);
  const event = {
    time: toUnixSeconds(data.timestamp),
    self_id: 0,
    post_type: "message",
    message_type: "group",
    sub_type: "normal",
    message_id: messageId,
    group_id: groupOpenid,
    user_id: userOpenid,
    message,
    raw_message: rawMessage,
    font: 0,
    anonymous: null,
    sender: {
      user_id: userOpenid,
      nickname: data.member?.nick ?? data.author?.username ?? "",
      card: data.member?.nick ?? "",
      sex: "unknown",
      age: 0,
      area: "",
      level: "",
      role: "member",
      title: "",
    },
    ...(reply ? { reply } : {}),
  } as unknown as OneBot11IncomingEvent;
  rememberIndexedMessage(data, messageId, userOpenid, rawMessage, message);
  return event;
}

function getUserOpenid(data: QQBotMessageEvent): string {
  return data.author?.user_openid
    ?? data.author?.member_openid
    ?? data.member?.user_openid
    ?? data.member?.member_openid
    ?? data.author?.id
    ?? "";
}

function normalizeContent(content: string | undefined): string {
  return (content ?? "").trim();
}

function buildOneBotMessage(
  data: QQBotMessageEvent,
  rawMessage: string,
  replyMessageId?: number
): OneBotMessageSegment[] {
  const segments: OneBotMessageSegment[] = [];
  replyMessageId ??= referencedOneBotMessageId(data);
  if (replyMessageId !== undefined) {
    segments.push({ type: "reply", data: { id: replyMessageId } });
  }
  segments.push({ type: "text", data: { text: rawMessage } });
  return segments;
}

function buildOneBotReply(data: QQBotMessageEvent): IndexedQQBotMessage | null {
  if (!isQQBotReferenceMessage(data)) return null;

  const referencedKey = referencedOfficialMessageId(data);
  if (!referencedKey) return null;

  return indexedMessages.get(referencedKey) ?? null;
}

function referencedOneBotMessageId(data: QQBotMessageEvent): number | undefined {
  const officialId = referencedOfficialMessageId(data);
  if (!officialId) return undefined;
  const messageId = hashToPositiveInt(officialId);
  rememberOfficialMessageId(messageId, officialId);
  return messageId;
}

export function referencedOfficialMessageId(data: QQBotMessageEvent): string | undefined {
  const sceneReferenceId = readMessageSceneValue(data, "ref_msg_idx")
    ?? readMessageSceneValue(data, "ref_idx");
  if (sceneReferenceId) return sceneReferenceId;

  const candidates: unknown[] = [
    data.message_reference,
    data.reference,
    data.referenced_message,
    data.reply,
    data.src_msg_id,
  ];

  for (const candidate of candidates) {
    const id = extractReferenceId(candidate);
    if (id) return id;
  }
  return undefined;
}

export function officialMessageIdForOneBotMessageId(messageId: number): string | undefined {
  return officialMessageIdsByOneBotMessageId.get(messageId);
}

function rememberIndexedMessage(
  data: QQBotMessageEvent,
  messageId: number,
  userId: string,
  rawMessage: string,
  message: OneBotMessageSegment[]
): void {
  const keys = [
    readMessageSceneValue(data, "msg_idx"),
    readMessageSceneValue(data, "ref_idx"),
    data.id,
    data.msg_id,
    data.event_id,
  ].filter((item): item is string => Boolean(item));

  if (keys.length === 0) return;
  rememberOfficialMessageId(messageId, keys[0]);

  const indexed: IndexedQQBotMessage = {
    message_id: messageId,
    user_id: userId,
    raw_message: rawMessage,
    message,
  };
  for (const key of keys) indexedMessages.set(key, indexed);

  while (indexedMessages.size > MAX_INDEXED_MESSAGES) {
    const firstKey = indexedMessages.keys().next().value;
    if (!firstKey) break;
    indexedMessages.delete(firstKey);
  }
}

function rememberOfficialMessageId(oneBotMessageId: number, officialMessageId: string): void {
  officialMessageIdsByOneBotMessageId.set(oneBotMessageId, officialMessageId);
  while (officialMessageIdsByOneBotMessageId.size > MAX_INDEXED_MESSAGES) {
    const firstKey = officialMessageIdsByOneBotMessageId.keys().next().value;
    if (firstKey === undefined) break;
    officialMessageIdsByOneBotMessageId.delete(firstKey);
  }
}

function isQQBotReferenceMessage(data: QQBotMessageEvent): boolean {
  return Number(data.message_type) === QQBOT_REFERENCE_MESSAGE_TYPE || Boolean(referencedOfficialMessageId(data));
}

function readMessageSceneValue(data: QQBotMessageEvent, key: string): string | undefined {
  const scene = data.message_scene;
  if (!scene) return undefined;

  const direct = readTextValue((scene as Record<string, unknown>)[key]);
  if (direct) return direct;

  for (const item of scene.ext ?? []) {
    if (typeof item === "string") {
      const separator = item.indexOf("=");
      if (separator <= 0) continue;
      const itemKey = item.slice(0, separator).trim();
      if (itemKey !== key) continue;
      const value = item.slice(separator + 1).trim();
      if (value) return value;
    } else if (item && typeof item === "object") {
      const value = readTextValue((item as Record<string, unknown>)[key]);
      if (value) return value;
    }
  }

  return undefined;
}

function renderMsgElementsText(elements: QQBotMessageEvent["msg_elements"]): string {
  if (!Array.isArray(elements)) return "";
  return elements
    .map(renderMsgElementText)
    .filter(Boolean)
    .join("")
    .trim();
}

function renderMsgElementText(element: unknown): string {
  if (!element || typeof element !== "object" || Array.isArray(element)) return "";
  const record = element as Record<string, unknown>;

  const text = readTextValue(record.content)
    ?? readTextValue(record.text)
    ?? readNestedText(record.data);
  const nested = renderMsgElementsText(record.elements as QQBotMessageEvent["msg_elements"])
    || renderMsgElementsText(record.msg_elements as QQBotMessageEvent["msg_elements"]);

  return `${text ?? ""}${nested}`;
}

function readNestedText(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return readTextValue(record.content) ?? readTextValue(record.text);
}

function readTextValue(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  return readTextValue(record.content) ?? readTextValue(record.text);
}

function extractReferenceId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const record = value as Record<string, unknown>;
  for (const key of ["message_id", "msg_id", "id", "event_id", "src_msg_id"]) {
    const id = extractReferenceId(record[key]);
    if (id) return id;
  }
  return undefined;
}

function toUnixSeconds(timestamp: string | undefined): number {
  if (!timestamp) return Math.floor(Date.now() / 1000);
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : Math.floor(Date.now() / 1000);
}

function stableMessageId(data: QQBotMessageEvent, payload: QQBotWebhookPayload): number {
  const source = data.msg_id ?? data.id ?? data.event_id ?? payload.id ?? `${Date.now()}`;
  return hashToPositiveInt(source);
}

function hashToPositiveInt(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}
