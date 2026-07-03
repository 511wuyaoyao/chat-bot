/**
 * 群聊自己 @ 自己分类
 * 识别当前账号在群聊里 @ 当前账号的消息，用于手动触发 agent。
 */

import { buildMessageSegments, isMentioningSelf, stripLeadingSelfMention } from "../../message-segments";
import { QqMessagePipelineHandler } from "../../types";

export const groupSelfMentionSelfHandler: QqMessagePipelineHandler = {
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
