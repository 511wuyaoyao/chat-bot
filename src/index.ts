/**
 * QQ 个人管家 Bot 入口
 */

import { validateConfig } from "./config";
import "./tools";
import { QqAdapter, QqMessage } from "./qq/adapter";
import { MsgHeartbeat } from "./qq/connection";
import { MessageQueue } from "./router/message-queue";
import { startProactive } from "./scheduler/proactive";
import { logger, cleanOldLogs } from "./utils/logger";

async function main() {
  await cleanOldLogs();
  logger.info("QQ 个人管家 Bot 启动中...");

  const errors = validateConfig();
  if (errors.length > 0) {
    for (const err of errors) logger.error(err);
    if (errors.some((e) => e.includes("DEEPSEEK_API_KEY"))) process.exit(1);
  }

  const queue = new MessageQueue();
  const adapter = new QqAdapter({
    onMessage: (msg: QqMessage) => { queue.enqueue(msg); return Promise.resolve(null); },
    onRecall: (id: number) => { queue.recall(id); },
  });
  queue.setAdapter(adapter);

  adapter.start();

  const heartbeat = new MsgHeartbeat(adapter);
  heartbeat.start();

  const stopProactive = startProactive(adapter);

  const shutdown = () => {
    logger.info("正在关闭...");
    heartbeat.stop();
    stopProactive();
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
