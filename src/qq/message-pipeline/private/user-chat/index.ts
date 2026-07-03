/**
 * 用户私聊 agent 分类
 * 识别非当前账号私聊消息，并按用户白名单决定是否放行。
 */

import { buildMessageSegments } from "../../message-segments";
import { QqMessagePipelineHandler } from "../../types";

export const privateUserChatHandler: QqMessagePipelineHandler = {
  category: "private_user_chat",

  match(input) {
    if (input.messageType !== "private") return false;
    return !input.isSelfSent && String(input.userId) !== input.selfId;
  },

  process(input) {
    const accepted = input.userWhitelist.includes(String(input.userId));
    const rawMessage = input.rawMessage.trim();
    return {
      category: this.category,
      accepted,
      rawMessage,
      messageSegments: buildMessageSegments(rawMessage, input.rawSegments),
      reason: accepted ? undefined : "private_user_not_whitelisted",
    };
  },
};
