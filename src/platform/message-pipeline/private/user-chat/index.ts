/**
 * 鐢ㄦ埛绉佽亰 agent 鍒嗙被
 * 璇嗗埆闈炲綋鍓嶈处鍙风鑱婃秷鎭紝骞舵寜鐢ㄦ埛鐧藉悕鍗曞喅瀹氭槸鍚︽斁琛屻€? */

import { buildMessageSegments } from "../../../internal/message-segments";
import { InternalMessagePipelineHandler } from "../../types";

export const privateUserChatHandler: InternalMessagePipelineHandler = {
  category: "private_user_chat",

  match(input) {
    if (input.messageType !== "private") return false;
    return !input.isSelfSent && String(input.userId) !== input.selfId;
  },

  process(input) {
    const accepted = input.userRegistered && input.personId !== undefined && input.userWhitelist.includes(input.personId);
    const rawMessage = input.rawMessage.trim();
    return {
      category: this.category,
      accepted,
      rawMessage,
      messageSegments: buildMessageSegments(rawMessage, input.rawSegments),
      reason: accepted ? undefined : "user_account_not_registered",
    };
  },
};

