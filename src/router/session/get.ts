/**
 * 上下文窗口构建
 * 返回：[system_prompt, ...history, attention]
 * 注意力消息不持久化，每次动态注入
 */

import { StoredMessage } from "./utils/types";
import { getCache } from "./set";
import { buildSystemPrompt } from "./utils/system-prompt";
import { buildAttention } from "../../agent/attention/index";
import { logger } from "../../utils/logger";

function toolCallIds(msg: StoredMessage): string[] {
  if (msg.role !== "assistant" || !Array.isArray(msg.tool_calls)) return [];
  return msg.tool_calls
    .map((tc) => (tc as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function toApiMessage(msg: StoredMessage): StoredMessage {
  const { id: _id, timestamp: _timestamp, message_id: _messageId, ...apiMsg } = msg;
  return apiMsg;
}

function sanitizeHistory(sessionId: string, history: StoredMessage[]): StoredMessage[] {
  const result: StoredMessage[] = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    const expectedToolIds = toolCallIds(msg);

    if (msg.role === "tool") {
      logger.warn("过滤孤立 tool 消息，避免 OpenAI tool_calls 校验失败", {
        sessionId,
        tool_call_id: msg.tool_call_id,
      });
      continue;
    }

    if (expectedToolIds.length === 0) {
      result.push(toApiMessage(msg));
      continue;
    }

    const toolMessages: StoredMessage[] = [];
    let cursor = i + 1;
    while (cursor < history.length && history[cursor].role === "tool") {
      toolMessages.push(history[cursor]);
      cursor++;
    }

    const actualIds = new Set(toolMessages.map((toolMsg) => toolMsg.tool_call_id).filter(Boolean));
    const complete = expectedToolIds.every((id) => actualIds.has(id));

    if (!complete) {
      logger.warn("过滤不完整 tool_calls 历史片段，避免 OpenAI tool_calls 校验失败", {
        sessionId,
        expectedToolIds,
        actualToolIds: Array.from(actualIds),
      });
      i = cursor - 1;
      continue;
    }

    result.push(toApiMessage(msg));
    result.push(...toolMessages.map(toApiMessage));
    i = cursor - 1;
  }

  return result;
}

/** 获取完整上下文窗口数组。baseDir 仅 agentLoop 内部使用 */
export function get(
  sessionId: string,
  userId: string,
  opts?: { systemPrompt?: string; skipAttention?: boolean; baseDir?: string }
): StoredMessage[] {
  const history = getCache(sessionId, opts?.baseDir);
  const safeHistory = sanitizeHistory(sessionId, history);
  const systemContent = opts?.systemPrompt ?? buildSystemPrompt();

  const result: StoredMessage[] = [
    { role: "system", content: systemContent },
    ...safeHistory,
  ];

  if (!opts?.skipAttention) {
    const attentionText = buildAttention(userId, sessionId);
    if (attentionText) {
      result.push({ role: "assistant", content: attentionText });
    }
  }

  return result;
}
