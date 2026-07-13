/**
 * 缇よ亰鐢ㄦ埛 @ agent 鍒嗙被
 * 璇嗗埆缇よ亰涓叾浠栫敤鎴?@ 褰撳墠璐﹀彿鐨勬秷鎭紝骞舵墽琛岀兢鍜岀敤鎴风櫧鍚嶅崟杩囨护銆? */

import { buildMessageSegments, isMentioningSelf, stripLeadingSelfMention } from "../../../internal/message-segments";
import { InternalMessagePipelineHandler } from "../../types";

export const groupMentionAgentHandler: InternalMessagePipelineHandler = {
  category: "group_mention_agent",

  match(input) {
    if (input.messageType !== "group") return false;
    const isSelf = Boolean(input.isSelfSent) || String(input.userId) === input.selfId;
    return !isSelf && isMentioningSelf(input.rawMessage, input.rawSegments, input.selfId);
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

    const accepted = input.userWhitelist.includes(String(input.userId));
    const rawMessage = stripLeadingSelfMention(input.rawMessage, input.rawSegments, input.selfId);
    return {
      category: this.category,
      accepted,
      rawMessage,
      messageSegments: buildMessageSegments(rawMessage, input.rawSegments),
      reason: accepted ? undefined : "group_user_not_whitelisted",
    };
  },
};

