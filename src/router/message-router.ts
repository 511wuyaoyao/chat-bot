/**
 * 消息网关 — main-agent 对话路由
 * topic-agent 通过独立队列消费，不在此层直接调用
 */

import { QqMessage } from "../qq/adapter";
import { mainAgent } from "../agent/agents/main-agent/index";
import { getOrCreateSession, switchSession } from "./data-index";
import { enqueueDialogue } from "../agent/agents/topic-agent/queue";
import { ProgressCallback } from "../agent/agent-loop";
import { set as archiveSet } from "./archive/set";
import { logger } from "../utils/logger";
import { commandRegistry } from "./commands/registry";

import "./commands/help";
import "./commands/start";
import "./commands/admin";
import "./commands/topic";
import "./commands/token";

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

  const userPrompt = buildUserPrompt(msg);

  // 正常对话 → 主 Agent
  const reply = await mainAgent(sid, userId, userPrompt, onProgress, msg.message_id, {
    qqMessage: {
      messageType: msg.message_type,
      groupId: msg.group_id,
      userId,
      sender: msg.sender,
      category: msg.category,
    },
  });

  // 归档 assistant 回复（user 消息已在 message-queue 入队时归档）
  if (reply) {
    archiveSet(sid, { role: "assistant", content: reply });
  }

  // 主 Agent 回复后 → 对话轮次入队，topic-agent 独立消费
  if (reply && sendMessage) {
    enqueueDialogue({
      userId,
      mainSessionId: sid,
      userMessage: userPrompt,
      assistantReply: reply,
    });
  }

  return reply;
}

function buildUserPrompt(msg: QqMessage): string {
  const currentMessage = msg.raw_message.trim() || "用户当前未输入额外文本。";
  const quotedMessage = msg.reply?.parsed_message?.trim();
  if (!quotedMessage) return msg.raw_message.trim();

  return [
    "用户引用了下面这条消息：",
    `发送者 QQ：${msg.reply?.user_id}`,
    `消息 ID：${msg.reply?.message_id}`,
    "引用内容：",
    quotedMessage,
    "",
    "用户当前发送：",
    currentMessage,
  ].join("\n");
}
