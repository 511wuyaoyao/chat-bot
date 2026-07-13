/**
 * 合并转发消息段渲染器
 * 将 forward 消息段展开为 agent 可读的聊天记录文本。
 */

import { MessageSegmentRenderer } from "../types";
import { fetchForwardMessages } from "./client";
import { ForwardedMessage } from "./types";

export const forwardSegmentRenderer: MessageSegmentRenderer = {
  type: "forward",
  async render(segment, context) {
    const id = segment.data?.id;
    if (typeof id !== "string" || !id.trim()) return "[合并转发聊天记录]";

    try {
      const messages = await fetchForwardMessages(id.trim());
      if (!messages || messages.length === 0) return "[合并转发聊天记录读取失败]";

      const lines = await Promise.all(messages.map(async (message, index) => {
        const label = getSenderLabel(message);
        const text = await forwardedMessageToText(message, context.renderSegments);
        return `${index + 1}. ${label}: ${text || "[空消息]"}`;
      }));

      return ["[合并转发聊天记录]", ...lines].join("\n");
    } catch {
      return "[合并转发聊天记录读取失败]";
    }
  },
};

function getSenderLabel(message: ForwardedMessage): string {
  const sender = message.sender;
  const nickname = String(sender?.nickname ?? "");
  const userId = String(sender?.user_id ?? message.user_id ?? "");
  if (nickname && userId) return `${nickname}(${userId})`;
  return nickname || userId || "未知用户";
}

async function forwardedMessageToText(
  message: ForwardedMessage,
  renderSegments: (rawSegments: unknown) => Promise<string>
): Promise<string> {
  if (typeof message.raw_message === "string" && message.raw_message.trim()) {
    return message.raw_message.trim();
  }
  if (typeof message.content === "string" && message.content.trim()) {
    return message.content.trim();
  }
  return (await renderSegments(message.message)).trim();
}
