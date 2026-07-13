/**
 * 缇よ亰鍏ㄩ噺娑堟伅鍒嗙被
 * 璇嗗埆娌℃湁 @ 褰撳墠璐﹀彿鐨勭兢鑱婃櫘閫氭秷鎭紝褰撳墠榛樿鍙垎绫讳笉鏀捐銆? */

import { buildMessageSegments } from "../../../internal/message-segments";
import { InternalMessagePipelineHandler } from "../../types";

export const groupAllChatHandler: InternalMessagePipelineHandler = {
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

