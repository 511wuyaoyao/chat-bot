/**
 * 注意力层入口：组装长期记忆和本轮运行上下文。
 */

import { folderTreeContext } from "./folder_tree";
import { timeContext } from "./time";
import { topicQueueText } from "./topic_queue";
import { transactionEventAttentionText } from "../transaction-event";
import { groupChatAttentionText, GroupChatAttentionInput } from "./group_chat";

export interface AttentionRuntimeContext {
  platformMessage?: GroupChatAttentionInput;
}

export function buildAttention(
  userId: string,
  sessionId?: string,
  runtimeContext?: AttentionRuntimeContext
): string {
  const parts: string[] = [];

  const tree = folderTreeContext(userId);
  if (tree) parts.push(tree);

  const time = timeContext();
  if (time) parts.push(time);

  if (sessionId) {
    const mainSessionId = mainSessionIdOf(sessionId);
    const topics = topicQueueText(userId, mainSessionId);
    if (topics) parts.push(topics);
    const transactions = transactionEventAttentionText(userId, mainSessionId);
    if (transactions) parts.push(transactions);
  }

  const groupChat = runtimeContext?.platformMessage
    ? groupChatAttentionText(runtimeContext.platformMessage)
    : undefined;
  if (groupChat) parts.push(groupChat);

  return parts.join("\n\n");
}

function mainSessionIdOf(sessionId: string): string {
  return sessionId.replace(/_(topic|exec)$/, "");
}
