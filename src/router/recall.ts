/**
 * 撤回处理 — router 层负责归档撤回日志 + 删除 session 上下文
 * message-queue 仅负责队列清理（移除 pending + 中断），调此函数完成存储层操作
 */

import path from "path";
import { set as archiveSet } from "./archive/set";
import { recallUserMessage } from "./session/set";
import { logger } from "../utils/logger";

const DATA_ROOT = path.resolve(process.cwd(), "data");

/**
 * 处理用户撤回
 */
export function handleRecall(
  userId: string,
  sessionId: string,
  messageId: number
): void {
  // 1) 归档撤回日志
  archiveSet(sessionId, {
    role: "system",
    content: `用户撤回消息 [id=${messageId}]`,
  });

  // 2) 从 session 上下文中按 message_id 删除
  const mainBaseDir = path.join(DATA_ROOT, userId, "session", sessionId, "main");
  const topicBaseDir = path.join(DATA_ROOT, userId, "session", sessionId, "topic");

  const removedMain = recallUserMessage(sessionId, messageId, mainBaseDir);
  const removedTopic = recallUserMessage(sessionId, messageId, topicBaseDir);

  logger.debug(`撤回 ${messageId}: main=${removedMain} topic=${removedTopic}`);
}
