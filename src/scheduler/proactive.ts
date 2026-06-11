/**
 * 主动消息调度 — 定时任务 check + 内置主动对话
 * 独立于用户消息流，绕过 main-agent / queue 直接调 agentLoop
 */

import { config } from "../config";
import { agentLoop } from "../agent/agent-loop";
import { start as startChecker, stopAll as stopAllCheckers } from "../tools/schedule_tools/schedule_engine/checker";
import { addSchedule, getSchedule } from "../tools/schedule_tools/schedule_engine/schedule-engine";
import { nowLocal } from "../utils/time-utils";
import { logger } from "../utils/logger";
import { PROACTIVE_MESSAGE } from "../messages";
import type { QqAdapter } from "../qq/adapter";

const PROACTIVE_ID = "system_proactive";

export function startProactive(adapter: QqAdapter): () => void {
  for (const userId of config.qq.whitelist) {
    const checkerSid = `${userId}_checker`;

    if (!getSchedule(userId, PROACTIVE_ID)) {
      addSchedule(userId, {
        id: PROACTIVE_ID,
        type: "recurring",
        entryTitle: "主动对话",
        triggerAt: nowLocal(new Date(Date.now() + 5 * 60_000)),
        repeatRule: "daily:10:00",
        message: PROACTIVE_MESSAGE,
        enabled: true,
        createdAt: nowLocal(),
      });
      logger.info("内置主动对话任务已创建", { userId });
    }

    startChecker(userId, async (uid, entry) => {
      try {
        const prompt = entry.id === PROACTIVE_ID
          ? entry.message!
          : entry.type === "recurring"
            ? `定时任务触发：${entry.entryTitle}。请用自然的中文通知用户。`
            : `一次任务到期：${entry.entryTitle}（${entry.triggerAt.slice(0, 16)}）。请通知用户，用户回应后立刻 delete_schedule 清理。`;
        const reply = await agentLoop(checkerSid, uid, prompt);
        await adapter.sendMessage("private", uid, reply);
      } catch (err) {
        logger.error("轮询发送失败", { error: String(err), userId: uid });
      }
    });
  }

  return () => stopAllCheckers();
}
