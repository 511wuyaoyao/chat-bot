/**
 * 群聊全量消息分类
 * 识别没有 @ 当前账号的群聊普通消息，当前默认只分类不放行。
 */

import { buildMessageSegments } from "../../message-segments";
import { QqMessagePipelineHandler } from "../../types";

export const groupAllChatHandler: QqMessagePipelineHandler = {
  category: "group_all_chat",

  match(input) {
    return input.messageType === "group";
  },

  process(input) {
    const groupId = input.groupId ? String(input.groupId) : "";
    if (!groupId || !input.groupWhitelist.includes(groupId)) {
      const rawMessage = input.rawMessage.trim();
      return {
        category: this.category,
        accepted: false,
        rawMessage,
        messageSegments: buildMessageSegments(rawMessage, input.rawSegments),
        reason: "group_not_whitelisted",
      };
    }

    const rawMessage = input.rawMessage.trim();
    return {
      category: this.category,
      accepted: false,
      rawMessage,
      messageSegments: buildMessageSegments(rawMessage, input.rawSegments),
      reason: "group_all_chat_not_enabled",
    };
  },
};
