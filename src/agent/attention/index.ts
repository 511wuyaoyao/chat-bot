/**
 * 注意力层 — 组装长期记忆 → 本轮上下文的全部信息源
 * 每次 Agent 循环调用 buildAttention(userId)，注入到对话上下文
 *
 * 四个来源：
 *   1. 目录树（folder_tree） — 用户所有数据的树状视图
 *   2. 当前时间（time）
 *   3. 话题队列（topic_queue） — Topic Agent 提炼的未消费话题
 */

import { folderTreeContext } from "./folder_tree";
import { timeContext } from "./time";
import { topicQueueText } from "./topic_queue";
import { transactionEventAttentionText } from "../transaction-event";
import { groupChatAttentionText, GroupChatAttentionInput } from "./group_chat";

export interface AttentionRuntimeContext {
  qqMessage?: GroupChatAttentionInput;
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

  const groupChat = runtimeContext?.qqMessage
    ? groupChatAttentionText(runtimeContext.qqMessage)
    : undefined;
  if (groupChat) parts.push(groupChat);

  return parts.join("\n\n");
}

function mainSessionIdOf(sessionId: string): string {
  return sessionId.replace(/_(topic|exec)$/, "");
}
