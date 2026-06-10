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

export function buildAttention(userId: string): string {
  const parts: string[] = [];

  const tree = folderTreeContext(userId);
  if (tree) parts.push(tree);

  const time = timeContext();
  if (time) parts.push(time);

  const topics = topicQueueText(userId);
  if (topics) parts.push(topics);

  return parts.join("\n\n");
}
