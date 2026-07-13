/**
 * 个人管家 Bot 入口。
 */

import { validateConfig } from "./config";
import "./tools";
import { recordTokenUsage } from "./agent/token-usage";
import { Platform, InternalMessage, MsgHeartbeat } from "./platform/output";
import { getOrCreateSession } from "./router/data-index";
import { MessageQueue } from "./router/message-queue";
import { startProactive } from "./scheduler/proactive";
import { logger, cleanOldLogs } from "./utils/logger";
import { startDebugServer } from "./debug/server";

async function main() {
  await cleanOldLogs();
  logger.info("个人管家 Bot 启动中...");

  const errors = validateConfig();
  if (errors.length > 0) {
    for (const err of errors) logger.error(err);
    if (errors.some((e) => e.includes("DEEPSEEK_API_KEY"))) process.exit(1);
  }

  const queue = new MessageQueue();
  const platform = new Platform({
    onMessage: async (msg: InternalMessage) => { queue.enqueue(msg); },
    onRecall: (uid: string, id: number) => { queue.recall(uid, id); },
    onTokenUsage: (userId: string, actor: string, usage: unknown) => {
      recordTokenUsage({
        userId,
        mainSessionId: getOrCreateSession(userId),
        actor,
        usage,
      });
    },
  });
  queue.setAdapter(platform);

  platform.start();

  const heartbeat = new MsgHeartbeat(platform);
  heartbeat.start();

  const stopProactive = startProactive((msg) => queue.enqueue(msg));
  const stopDebugServer = startDebugServer();

  const shutdown = () => {
    logger.info("正在关闭...");
    heartbeat.stop();
    stopProactive();
    stopDebugServer?.();
    platform.stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error("启动失败", { error: String(err) });
  process.exit(1);
});
