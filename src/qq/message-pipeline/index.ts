/**
 * QQ 消息处理流水线入口
 * 按固定优先级把消息交给各处理器，并返回过滤与清洗结果。
 */

import { groupAllChatHandler } from "./group/all-chat";
import { groupMentionAgentHandler } from "./group/mention-agent";
import { groupSelfMentionSelfHandler } from "./group/self-mention-self";
import { privateSelfChatHandler } from "./private/self-chat";
import { privateUserChatHandler } from "./private/user-chat";
import { buildMessageSegments, normalizeMessageSegments } from "./message-segments";
import { QqMessagePipelineInput, QqMessagePipelineResult } from "./types";

export { normalizeMessageSegments } from "./message-segments";
export type { QqMessagePipelineInput, QqMessagePipelineResult } from "./types";

const handlers = [
  privateSelfChatHandler,
  privateUserChatHandler,
  groupSelfMentionSelfHandler,
  groupMentionAgentHandler,
  groupAllChatHandler,
];

export function processQqMessage(input: QqMessagePipelineInput): QqMessagePipelineResult {
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
