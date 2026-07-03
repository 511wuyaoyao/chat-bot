/**
 * 自己私聊自己分类
 * 识别当前账号发给自己的私聊消息并直接放行。
 */

import { buildMessageSegments } from "../../message-segments";
import { QqMessagePipelineHandler } from "../../types";

export const privateSelfChatHandler: QqMessagePipelineHandler = {
  category: "private_self_chat",

  match(input) {
    if (input.messageType !== "private") return false;
    return Boolean(input.isSelfSent) || String(input.userId) === input.selfId;
  },

  process(input) {
    const rawMessage = input.rawMessage.trim();
    return {
      category: this.category,
      accepted: true,
      rawMessage,
      messageSegments: buildMessageSegments(rawMessage, input.rawSegments),
    };
  },
};
