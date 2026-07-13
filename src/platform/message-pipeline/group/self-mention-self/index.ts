/**
 * 缇よ亰鑷繁 @ 鑷繁鍒嗙被
 * 璇嗗埆褰撳墠璐﹀彿鍦ㄧ兢鑱婇噷 @ 褰撳墠璐﹀彿鐨勬秷鎭紝鐢ㄤ簬鎵嬪姩瑙﹀彂 agent銆? */

import { buildMessageSegments, isMentioningSelf, stripLeadingSelfMention } from "../../../internal/message-segments";
import { InternalMessagePipelineHandler } from "../../types";

export const groupSelfMentionSelfHandler: InternalMessagePipelineHandler = {
  category: "group_self_mention_self",

  match(input) {
    if (input.messageType !== "group") return false;
    const isSelf = Boolean(input.isSelfSent) || String(input.userId) === input.selfId;
    return isSelf && isMentioningSelf(input.rawMessage, input.rawSegments, input.selfId);
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

    const rawMessage = stripLeadingSelfMention(input.rawMessage, input.rawSegments, input.selfId);
    return {
      category: this.category,
      accepted: true,
      rawMessage,
      messageSegments: buildMessageSegments(rawMessage, input.rawSegments),
    };
  },
};

