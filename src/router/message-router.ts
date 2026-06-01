/**
 * 消息路由主入口
 * 编排完整处理流程：上下文记录 → 预分类 → Agent Loop（含工具调用）
 */

import { config } from "../config";
import { QqMessage } from "../qq/adapter";
import { pushContext, getContext } from "./context-manager";
import { preClassify } from "./pre-classify";
import { agentLoop, ProgressCallback } from "../agent/agent-loop";
import { logger } from "../utils/logger";

/** 处理收到的 QQ 消息，返回回复文本 */
export async function routeMessage(
  msg: QqMessage,
  onProgress?: ProgressCallback
): Promise<string | null> {
  const userId = String(msg.user_id);
  const text = msg.raw_message.trim();

  if (!text) return null;

  // 1. 记录用户消息到上下文
  pushContext(userId, "user", text);

  // 2. 规则预分类（根据配置开关）
  const hint = config.features.enableRegexPreClassify ? preClassify(text) : null;
  if (hint) {
    logger.debug(`预分类结果`, { hint, text });
  }

  // 3. 获取上下文
  const context = getContext(userId);

  // 4. Agent Loop：AI 自主决定调用哪些工具
  const reply = await agentLoop(userId, text, context, hint, onProgress);

  // 5. 记录 Bot 回复到上下文
  if (reply) {
    pushContext(userId, "assistant", reply);
  }

  return reply;
}
