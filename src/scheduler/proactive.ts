/**
 * 主动消息调度：定时任务检查和内置主动对话。
 */

import { config } from "../config";
import { start as startChecker, stopAll as stopAllCheckers } from "../tools/schedule_tools/schedule_engine/checker";
import { logger } from "../utils/logger";
import { PROACTIVE_MESSAGE } from "../prompt";
import type { InternalMessage } from "../platform/output";

const PROACTIVE_ID = "system_proactive";
let systemMessageSeq = 0;

export type ProactiveEnqueue = (msg: InternalMessage) => void;

export function startProactive(enqueue: ProactiveEnqueue): () => void {
  for (const userId of config.qq.whitelist) {
    startChecker(userId, async (uid, entry) => {
      try {
        const prompt = entry.id === PROACTIVE_ID
          ? entry.message || PROACTIVE_MESSAGE
          : entry.type === "recurring"
          ? `定时任务触发：${entry.entryTitle}。请用自然的中文通知用户。`
          : `一次任务到期：${entry.entryTitle}（${entry.triggerAt.slice(0, 16)}）。请通知用户，用户回应后立刻 delete_schedule 清理。`;
        enqueue(buildSystemMessage(uid, prompt));
      } catch (err) {
        logger.error("轮询入队失败", { error: String(err), userId: uid });
      }
    });
  }

  return () => stopAllCheckers();
}

function buildSystemMessage(userId: string, prompt: string): InternalMessage {
  return {
    message_id: nextSystemMessageId(),
    user_id: Number(userId),
    message_type: "private",
    raw_message: prompt,
    original_raw_message: prompt,
    category: "private_user_chat",
    sender: {
      nickname: "系统轮询",
    },
    reply: null,
  };
}

function nextSystemMessageId(): number {
  systemMessageSeq += 1;
  return -Date.now() - systemMessageSeq;
}
