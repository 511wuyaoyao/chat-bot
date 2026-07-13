/**
 * Topic 对话队列 — 收集 main-agent 对话轮次，串行消费交给 topic-agent 分析
 * 没有定时器，纯队列驱动，天然防并发
 */

import { logger } from "../../../utils/logger";
import { topicAgent } from "./index";

export interface DialogueItem {
  userId: string;
  mainSessionId: string;
  userMessage: string;
  assistantReply: string;
  userMessageId: string;
  assistantMessageId?: string;
}

const pending: DialogueItem[] = [];
let consuming = false;

/** 将一轮对话入队，自动触发消费 */
export function enqueueDialogue(item: DialogueItem): void {
  pending.push(item);
  if (!consuming) {
    consuming = true;
    consumeLoop();
  }
}

async function consumeLoop(): Promise<void> {
  while (pending.length > 0) {
    const item = pending.shift()!;
    try {
      await topicAgent(item.userId, item.mainSessionId, item);
    } catch (err) {
      logger.debug("Topic Agent 失败", { error: String(err) });
    }
  }
  consuming = false;
}
