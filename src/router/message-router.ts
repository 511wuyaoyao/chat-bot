/**
 * 消息网关 — main-agent 对话路由
 * topic-agent 通过独立队列消费，不在此层直接调用
 */

import { QqMessage } from "../qq/adapter";
import { mainAgent } from "../agent/agents/main-agent/index";
import { getOrCreateSession, switchSession } from "./session/manage";
import { enqueueDialogue } from "../agent/agents/topic-agent/queue";
import { ProgressCallback } from "../agent/agent-loop";
import { set as archiveSet } from "./archive/set";
import { logger } from "../utils/logger";
import { commandRegistry } from "./commands/registry";

import "./commands/help";
import "./commands/start";

// 向后兼容
export { getOrCreateSession };
export { switchSession };

export async function messageRouter(
  msg: QqMessage,
  onProgress?: ProgressCallback,
  /** topic-agent 发消息的通道 */
  sendMessage?: (text: string) => Promise<number | null>
): Promise<string | null> {
  const userId = String(msg.user_id);
  const raw = msg.raw_message;
  if (!raw) return null;

  const sid = getOrCreateSession(userId);

  // 指令
  const cmd = commandRegistry.match(raw);
  if (cmd) {
    logger.debug("指令执行", { userId, command: cmd.handler.name });
    return cmd.handler.execute(userId, cmd.args);
  }

  // 正常对话 → 主 Agent
  const reply = await mainAgent(sid, userId, raw.trim(), onProgress);

  // 归档 assistant 回复（user 消息已在 message-queue 入队时归档）
  if (reply) {
    archiveSet(sid, { role: "assistant", content: reply });
  }

  // 主 Agent 回复后 → 对话轮次入队，topic-agent 独立消费
  if (reply && sendMessage) {
    enqueueDialogue({
      userId,
      mainSessionId: sid,
      userMessage: raw.trim(),
      assistantReply: reply,
    });
  }

  return reply;
}
