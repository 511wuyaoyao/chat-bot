/**
 * 鑷繁绉佽亰鑷繁鍒嗙被
 * 璇嗗埆褰撳墠璐﹀彿鍙戠粰鑷繁鐨勭鑱婃秷鎭苟鐩存帴鏀捐銆? */

import { buildMessageSegments } from "../../../internal/message-segments";
import { InternalMessagePipelineHandler } from "../../types";

export const privateSelfChatHandler: InternalMessagePipelineHandler = {
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

