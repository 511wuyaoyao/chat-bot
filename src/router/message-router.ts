/**
 * 消息网关：负责命令拦截、main-agent 调用和 topic 入队。
 */

import path from "path";
import { InternalMessage } from "../platform/output";
import { mainAgent } from "../agent/agents/main-agent/index";
import { getOrCreateSession, switchSession } from "./data-index";
import { enqueueDialogue } from "../agent/agents/topic-agent/queue";
import { ProgressCallback } from "../agent/agent-loop";
import { set as archiveSet } from "./archive/set";
import { updateLatestAssistantMessageId } from "./session/set";
import { logger } from "../utils/logger";
import { commandRegistry } from "./commands/registry";

import "./commands/help";
import "./commands/start";
import "./commands/admin";
import "./commands/topic";
import "./commands/token";

export { getOrCreateSession };
export { switchSession };

export interface MessageRouterResult {
  reply: string | null;
  onReplySent?: (messageId: number | null) => void;
}

export async function messageRouter(
  msg: InternalMessage,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<MessageRouterResult> {
  const userId = String(msg.user_id);
  const raw = msg.raw_message;
  if (!raw) return { reply: null };

  const sid = getOrCreateSession(userId);

  const cmd = commandRegistry.match(raw);
  if (cmd) {
    logger.debug("命令执行", { userId, command: cmd.handler.name });
    return { reply: await cmd.handler.execute(userId, cmd.args) };
  }

  const userPrompt = buildUserPrompt(msg);

  const reply = await mainAgent(sid, userId, userPrompt, onProgress, msg.message_id, {
    platformMessage: {
      messageType: msg.message_type,
      groupId: msg.group_id,
      userId,
      sender: msg.sender,
      category: msg.category,
    },
  }, signal);

  if (reply) {
    archiveSet(sid, { role: "assistant", content: reply });
  }

  return {
    reply,
    onReplySent: (assistantMessageId) => {
      const assistantMessageIdText = assistantMessageId === null ? undefined : String(assistantMessageId);
      if (assistantMessageIdText) {
        updateLatestAssistantMessageId(sid, assistantMessageIdText, mainContextDir(userId, sid));
      }

      if (reply) {
        enqueueDialogue({
          userId,
          mainSessionId: sid,
          userMessage: userPrompt,
          assistantReply: reply,
          userMessageId: String(msg.message_id),
          assistantMessageId: assistantMessageIdText,
        });
      }
    },
  };
}

function mainContextDir(userId: string, sessionId: string): string {
  return path.join(process.cwd(), "data", userId, "session", sessionId, "main");
}

function buildUserPrompt(msg: InternalMessage): string {
  const currentMessage = msg.raw_message.trim() || "用户当前未输入额外文本。";
  const quotedMessage = msg.reply?.parsed_message?.trim();
  if (!quotedMessage) return msg.raw_message.trim();

  return [
    "用户引用了下面这条消息：",
    `发送者：${msg.reply?.user_id}`,
    `消息 ID：${msg.reply?.message_id}`,
    "引用内容：",
    quotedMessage,
    "",
    "用户当前发送：",
    currentMessage,
  ].join("\n");
}
