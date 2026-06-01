/**
 * QQ 个人管家 Bot 入口
 * 初始化 Express/WS 服务，启动 QQ 适配器、文件引擎和调度器
 */

import "./tools"; // 触发所有工具自注册
import { QqAdapter, QqMessage } from "./qq/adapter";
import { routeMessage } from "./router/message-router";
import { validateConfig, config } from "./config";
import { init as initFileEngine } from "./data/file-engine";
import { start as startScheduler, stopAll as stopAllSchedulers } from "./scheduler/scheduler";
import { initUserContext } from "./router/context-manager";
import { FALLBACK_API_ERROR } from "./messages";
import { logger } from "./utils/logger";

async function main() {
  logger.info("QQ 个人管家 Bot 启动中...");

  // 配置校验
  const errors = validateConfig();
  if (errors.length > 0) {
    for (const err of errors) {
      logger.error(err);
    }
    if (errors.some((e) => e.includes("DEEPSEEK_API_KEY"))) {
      process.exit(1);
    }
  }

  // 创建 QQ 适配器
  const adapter = new QqAdapter({
    onMessage: async (msg: QqMessage) => {
      try {
        const progressMsgIds: number[] = [];

        // 进度回调：发 QQ 消息记录 tool 执行过程
        const onProgress = async (
          _toolName: string,
          description: string
        ) => {
          const id = await adapter.sendMessage(
            msg.message_type,
            String(msg.user_id),
            description,
            msg.group_id
          );
          if (id) progressMsgIds.push(id);
        };

        // Agent Loop
        const reply = await routeMessage(msg, onProgress);

        // 撤回进度消息
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

  // 初始化文件引擎（为每个白名单用户扫描数据目录）
  for (const userId of config.qq.whitelist) {
    try {
      initFileEngine(userId);
      // 加载对话上下文
      initUserContext(userId);
      // 启动调度器
      startScheduler(userId, async (uid, message) => {
        try {
          await adapter.sendMessage("private", uid, message);
        } catch (err) {
          logger.error("调度器发送消息失败", { error: String(err), userId: uid });
        }
      });
    } catch (err) {
      logger.error(`用户 ${userId} 初始化失败`, { error: String(err) });
    }
  }

  // 优雅退出
  const shutdown = () => {
    logger.info("正在关闭...");
    stopAllSchedulers();
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
