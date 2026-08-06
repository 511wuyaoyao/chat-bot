/**
 * OneBot11 消息与 QQ 官方机器人发送 payload 之间的转换。
 */

import type { OneBotMessage, OneBotMessageSegment } from "../../protocol/onebot11";

export interface QQBotMessagePayload {
  content: string;
  referenceMessageId?: string;
}

export function oneBotMessageToQQBotContent(message: OneBotMessage): string {
  return oneBotMessageToQQBotPayload(message).content;
}

export function oneBotMessageToQQBotPayload(message: OneBotMessage): QQBotMessagePayload {
  if (typeof message === "string") return { content: message };

  const referenceMessageId = findReplyMessageId(message);
  const content = message
    .map((segment) => segmentToText(segment))
    .filter(Boolean)
    .join("");

  return {
    content,
    ...(referenceMessageId ? { referenceMessageId } : {}),
  };
}

function findReplyMessageId(message: OneBotMessageSegment[]): string | undefined {
  for (const segment of message) {
    if (segment.type !== "reply") continue;
    const id = "data" in segment && segment.data ? segment.data.id : undefined;
    if (typeof id === "string" && id.trim()) return id.trim();
    if (typeof id === "number" || typeof id === "bigint") return String(id);
  }
  return undefined;
}

function segmentToText(segment: OneBotMessageSegment): string {
  if (segment.type === "text") {
    return String("data" in segment && segment.data ? segment.data.text ?? "" : "");
  }
  if (segment.type === "at") return "";
  if (segment.type === "reply") return "";
  return `[${segment.type}]`;
}
