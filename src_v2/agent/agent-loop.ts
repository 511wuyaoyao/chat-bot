/**
 * 通用 Agent 循环引擎
 * 接受 tools + prompt + executor 参数，三个 Agent 共用
 * 上下文管理委托给 session 层（get/set）
 */

import OpenAI from "openai";
import { getLlmClient } from "../../src/agent/llm-client";
import { qaFallback } from "../../src/agent/qa-fallback";
import { ToolDefinition } from "../../src/agent/tool-registry";
import { config } from "../../src/config";
import { logger } from "../../src/utils/logger";
import { get } from "../../src/router/session/get";
import { set } from "../../src/router/session/set";
import { StoredMessage } from "../../src/router/session/utils/types";
import {
  TOOL_PROGRESS,
  FALLBACK_EMPTY_REPLY,
  FALLBACK_ALL_DONE,
} from "../../src/messages";

export type ProgressCallback = (toolName: string, description: string) => void;

export interface AgentLoopConfig {
  sessionId: string;
  userId: string;
  /** 输入文本（用户消息 或 上层 Agent 的任务描述） */
  text: string;
  /** 自定义 system prompt */
  systemPrompt: string;
  /** 自定义工具集 */
  tools: ToolDefinition[];
  /** 自定义工具执行器 */
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  /** 进度回调 */
  onProgress?: ProgressCallback;
  /** 是否跳过持久化 user message（子 Agent 复用上层会话时用） */
  skipUserMessage?: boolean;
  /** 是否持久化 tool_calls / tool_result（主 Agent 可关闭以对抗噪声） */
  persistToolCalls?: boolean;
  /** thinking 模式：disabled / enabled / max */
  thinkingMode?: "disabled" | "enabled" | "max";
  /** 最大迭代次数 */
  maxIterations?: number;
  /** 工具结果截断长度 */
  maxToolResultChars?: number;
}

export async function agentLoop(cfg: AgentLoopConfig): Promise<string> {
  const client = getLlmClient();
  const maxIter = cfg.maxIterations ?? config.agent.maxIterations;
  const maxChars = cfg.maxToolResultChars ?? 1500;

  // 持久化输入消息
  if (!cfg.skipUserMessage) {
    set(cfg.sessionId, cfg.userId, { role: "user", content: cfg.text });
  }

  for (let i = 0; i < maxIter; i++) {
    logger.debug(`${cfg.sessionId} loop 第 ${i + 1}/${maxIter} 轮`);

    const messages = get(cfg.sessionId, cfg.userId);

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model: config.deepseek.model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: cfg.tools as OpenAI.Chat.Completions.ChatCompletionTool[],
        tool_choice: "auto",
        temperature: config.agent.temperature,
        max_tokens: config.agent.maxTokens,
        ...thinkParams(cfg.thinkingMode ?? "disabled"),
      } as any);
    } catch (err) {
      logger.error(`API 调用失败 (round ${i + 1})`, { error: String(err), sessionId: cfg.sessionId });
      return qaFallback(cfg.text, get(cfg.sessionId, cfg.userId));
    }

    const choice = response.choices[0];
    if (!choice) {
      logger.warn("AI 响应为空", { sessionId: cfg.sessionId });
      return qaFallback(cfg.text, get(cfg.sessionId, cfg.userId));
    }

    const msg = choice.message;

    // 无工具调用 → 返回文本
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const reply = msg.content || FALLBACK_EMPTY_REPLY;
      if (cfg.persistToolCalls !== false) {
        set(cfg.sessionId, cfg.userId, { ...msg, role: "assistant", content: reply } as unknown as StoredMessage);
      }
      return reply;
    }

    // 有工具调用
    logger.debug(`${cfg.sessionId} 调用了 ${msg.tool_calls.length} 个工具`, {
      tools: msg.tool_calls.map((t) => t.function.name),
    });

    if (cfg.persistToolCalls !== false) {
      set(cfg.sessionId, cfg.userId, { ...msg, role: "assistant" } as unknown as StoredMessage);
    }

    for (const tc of msg.tool_calls) {
      const toolName = tc.function.name;
      const args = JSON.parse(tc.function.arguments);

      const progressText = TOOL_PROGRESS[toolName];
      if (cfg.onProgress && progressText) {
        const detail = args.query || args.title || args.titleOrId || "";
        cfg.onProgress(toolName, detail ? `${progressText} ${detail}` : progressText);
      }

      let toolResult: unknown;
      try {
        toolResult = await cfg.executeTool(toolName, args);
      } catch (err) {
        toolResult = { error: `工具执行出错：${String(err)}` };
        logger.warn(`工具 ${toolName} 执行失败`, { error: String(err) });
      }

      if (cfg.persistToolCalls !== false) {
        set(cfg.sessionId, cfg.userId, {
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult).slice(0, maxChars),
        });
      }
    }
  }

  logger.warn(`${cfg.sessionId} 达到最大迭代 ${maxIter}`);
  return FALLBACK_ALL_DONE;
}

function thinkParams(mode: string): Record<string, unknown> {
  if (mode === "disabled") return { thinking: { type: "disabled" } };
  return {
    thinking: { type: "enabled" },
    reasoning_effort: mode === "max" ? "max" : "high",
  };
}
