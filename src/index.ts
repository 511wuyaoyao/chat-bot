/**
 * QQ 个人管家 Bot 入口
 */

import { validateConfig, config } from "./config";
import "./tools";
import { QqAdapter, QqMessage } from "./qq/adapter";
import { routeMessage } from "./router/message-router";
import { start as startChecker, stopAll as stopAllCheckers } from "./tools/schedule_tools/schedule_engine/checker";
import { addSchedule, getSchedule } from "./tools/schedule_tools/schedule_engine/schedule-engine";
import { agentLoop } from "./agent/agent-loop";
import { create } from "./router/session/create";
import { FALLBACK_API_ERROR, PROACTIVE_MESSAGE } from "./messages";
import { nowLocal } from "./utils/time-utils";
import { logger } from "./utils/logger";

async function main() {
  logger.info("QQ 个人管家 Bot 启动中...");

  const errors = validateConfig();
  if (errors.length > 0) {
    for (const err of errors) logger.error(err);
    if (errors.some((e) => e.includes("DEEPSEEK_API_KEY"))) process.exit(1);
  }

  const adapter = new QqAdapter({
    onMessage: async (msg: QqMessage) => {
      try {
        const progressMsgIds: number[] = [];

        const onProgress = async (_toolName: string, description: string) => {
          const id = await adapter.sendMessage(
            msg.message_type,
            String(msg.user_id),
            description,
            msg.group_id
          );
          if (id) progressMsgIds.push(id);
        };

        const reply = await routeMessage(msg, onProgress);

        for (const id of progressMsgIds) {
          await adapter.recallMessage(id);
        }

        return reply;
      } catch (err) {
        logger.error("消息处理异常", { error: String(err) });
        return FALLBACK_API_ERROR;
      }
    },
  });

  adapter.start();

  // 心跳保活：定时给自己发消息，防止 NapCat↔QQ 空闲断连
  const heartbeatMin = config.qq.heartbeatMinutes;
  const selfId = config.qq.selfId;
  if (heartbeatMin > 0 && selfId) {
    const HB_MSG = "​"; // 零宽空格，不可见
    setInterval(async () => {
      try {
        await adapter.sendMessage("private", selfId, HB_MSG);
        logger.debug("心跳已发送");
      } catch {
        // 心跳失败忽略
      }
    }, heartbeatMin * 60_000);
    logger.info(`心跳保活已启用，间隔 ${heartbeatMin} 分钟`);
  } else if (!selfId) {
    logger.warn("未配置 QQ_SELF_ID，心跳保活未启用");
  }

  for (const userId of config.qq.whitelist) {
    const checkerSid = `${userId}_checker`;

    // 内置主动对话任务（不可删，只能关闭或调频率）
    const PROACTIVE_ID = "system_proactive";
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
        create(checkerSid, uid);
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

  const shutdown = () => {
    logger.info("正在关闭...");
    stopAllCheckers();
    adapter.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("启动失败", { error: String(err) });
  process.exit(1);
});
