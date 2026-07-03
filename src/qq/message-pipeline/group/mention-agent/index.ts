/**
 * 群聊用户 @ agent 分类
 * 识别群聊中其他用户 @ 当前账号的消息，并执行群和用户白名单过滤。
 */

import { buildMessageSegments, isMentioningSelf, stripLeadingSelfMention } from "../../message-segments";
import { QqMessagePipelineHandler } from "../../types";

export const groupMentionAgentHandler: QqMessagePipelineHandler = {
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
