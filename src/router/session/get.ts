/**
 * 上下文窗口构建
 * 返回：[system_prompt, ...history]
 * 动态注意力由 agentLoop 在当前用户消息前临时注入，不在 session 层处理
 */

import { StoredMessage } from "./utils/types";
import { getCache } from "./set";
import { logger } from "../../utils/logger";
import { config } from "../../config/output";

interface HistorySegment {
  messages: StoredMessage[];
  chars: number;
}

function toolCallIds(msg: StoredMessage): string[] {
  if (msg.role !== "assistant" || !Array.isArray(msg.tool_calls)) return [];
  return msg.tool_calls
    .map((tc) => (tc as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

function toApiMessage(msg: StoredMessage): StoredMessage {
  if (msg.role === "assistant") {
    const apiMsg: StoredMessage = { role: "assistant", content: msg.content };
    if (msg.tool_calls) apiMsg.tool_calls = msg.tool_calls;
    if (msg.name) apiMsg.name = msg.name;
    return apiMsg;
  }

  if (msg.role === "tool") {
    return {
      role: "tool",
      content: msg.content,
      tool_call_id: msg.tool_call_id,
    };
  }

  if (msg.role === "system") {
    return { role: "system", content: msg.content };
  }

  const apiMsg: StoredMessage = { role: "user", content: msg.content };
  if (msg.name) apiMsg.name = msg.name;
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

function messageCost(msg: StoredMessage): number {
  return JSON.stringify({
    role: msg.role,
    content: msg.content,
    tool_calls: msg.tool_calls,
    tool_call_id: msg.tool_call_id,
    name: msg.name,
  }).length;
}

function segmentHistory(history: StoredMessage[]): HistorySegment[] {
  const segments: HistorySegment[] = [];

  for (let i = 0; i < history.length; i++) {
    const msg = history[i];
    const messages = [msg];

    if (toolCallIds(msg).length > 0) {
      let cursor = i + 1;
      while (cursor < history.length && history[cursor].role === "tool") {
        messages.push(history[cursor]);
        cursor++;
      }
      i = cursor - 1;
    }

    segments.push({
      messages,
      chars: messages.reduce((sum, item) => sum + messageCost(item), 0),
    });
  }

  return segments;
}

function windowHistory(history: StoredMessage[]): StoredMessage[] {
  const maxMessages = config.agent.contextMaxMessages;
  const maxChars = config.agent.contextMaxChars;
  if (maxMessages <= 0 && maxChars <= 0) return history;

  const selected: HistorySegment[] = [];
  let totalMessages = 0;
  let totalChars = 0;

  for (const segment of segmentHistory(history).reverse()) {
    const nextMessages = totalMessages + segment.messages.length;
    const nextChars = totalChars + segment.chars;
    const exceedsMessages = maxMessages > 0 && nextMessages > maxMessages;
    const exceedsChars = maxChars > 0 && nextChars > maxChars;

    if (selected.length > 0 && (exceedsMessages || exceedsChars)) break;

    selected.push(segment);
    totalMessages = nextMessages;
    totalChars = nextChars;

    if (exceedsMessages || exceedsChars) break;
  }

  return selected.reverse().flatMap((segment) => segment.messages);
}

/** 获取完整上下文窗口数组。baseDir 仅 agentLoop 内部使用 */
export function get(
  sessionId: string,
  userId: string,
  opts?: { systemPrompt?: string; baseDir?: string }
): StoredMessage[] {
  const history = getCache(sessionId, opts?.baseDir);
  const activeHistory = history.filter((msg) => msg.deleted !== true);
  const safeHistory = sanitizeHistory(sessionId, activeHistory);
  const windowedHistory = windowHistory(safeHistory);
  const systemContent = opts?.systemPrompt ?? "你是用户的个人助理。请根据上下文自然回复。";

  return [
    { role: "system", content: systemContent },
    ...windowedHistory,
  ];
}
