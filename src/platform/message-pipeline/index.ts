/**
 * QQ 娑堟伅澶勭悊娴佹按绾垮叆鍙? * 鎸夊浐瀹氫紭鍏堢骇鎶婃秷鎭氦缁欏悇澶勭悊鍣紝骞惰繑鍥炶繃婊や笌娓呮礂缁撴灉銆? */

import { groupAllChatHandler } from "./group/all-chat";
import { groupMentionAgentHandler } from "./group/mention-agent";
import { groupSelfMentionSelfHandler } from "./group/self-mention-self";
import { privateSelfChatHandler } from "./private/self-chat";
import { privateUserChatHandler } from "./private/user-chat";
import { buildMessageSegments, normalizeMessageSegments } from "../internal/message-segments";
import { InternalMessagePipelineInput, InternalMessagePipelineResult } from "./types";

export { normalizeMessageSegments } from "../internal/message-segments";
export type { InternalMessagePipelineInput, InternalMessagePipelineResult } from "./types";

const handlers = [
  privateSelfChatHandler,
  privateUserChatHandler,
  groupSelfMentionSelfHandler,
  groupMentionAgentHandler,
  groupAllChatHandler,
];

export function processInternalMessage(input: InternalMessagePipelineInput): InternalMessagePipelineResult {
  const handler = handlers.find((item) => item.match(input));
  if (handler) return handler.process(input);

  return {
    category: "ignored",
    accepted: false,
    rawMessage: input.rawMessage.trim(),
    messageSegments: buildMessageSegments(input.rawMessage, input.rawSegments),
    reason: "no_message_category_matched",
  };
}

