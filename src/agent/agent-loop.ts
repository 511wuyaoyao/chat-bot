/**
 * Agent 主循环
 * 上下文管理完全委托给 session 层（get/set）
 * agent 自身不维护 messages[]，每轮从 session 取最新上下文
 */

import OpenAI from "openai";
import { getLlmClient } from "./llm-client";
import { toolRegistry, ToolDefinition } from "./tool-registry";
import { qaFallback } from "./qa-fallback";
import { config } from "../config";
import { logger } from "../utils/logger";
import { get } from "../router/session/get";
import { set as sessionSet } from "../router/session/set";
import { StoredMessage } from "../router/session/utils/types";
import { ensureDir } from "../router/session/utils/storage";
import {
  TOOL_PROGRESS,
  FALLBACK_EMPTY_REPLY,
  FALLBACK_ALL_DONE,
} from "../messages";

export type ProgressCallback = (toolName: string, description: string) => void;

const TOOL_RESULT_MAX_CHARS = 1500;

export async function agentLoop(
  sessionId: string,
  userId: string,
  text: string,
  onProgress?: ProgressCallback,
  opts?: {
    systemPrompt?: string;
    /** 自定义工具集，不传用全局 toolRegistry */
    tools?: ToolDefinition[];
    /** 自定义工具执行器，和 tools 配套 */
    executeTool?: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    /** 最大迭代次数，不传用全局配置 */
    maxIterations?: number;
    /** 覆写模型 */
    model?: string;
    /** 覆写 temperature，0 表示不覆写 */
    temperature?: number;
    /** 覆写 maxTokens，0 表示不覆写 */
    maxTokens?: number;
    /** 跳过 attention 注入 */
    skipAttention?: boolean;
    /** 是否持久化 tool_calls 到 context，默认 true */
    persistToolCalls?: boolean;
    /** 覆写存储目录（用于 main/ topic/ 子目录场景），不传则使用默认 sessionDir(sessionId) */
    storageDir?: string;
  }
): Promise<string> {
  const client = getLlmClient();
  const maxIterations = opts?.maxIterations ?? config.agent.maxIterations;
  const tools = opts?.tools ?? toolRegistry.getDefinitions();
  const execute = opts?.executeTool ?? ((name, args) => toolRegistry.execute(name, args, userId));

  const baseDir = opts?.storageDir;

  // 确保 session 目录存在
  ensureDir(sessionId, baseDir);

  // 持久化用户消息，后续每轮从 session 取完整上下文
  sessionSet(sessionId, { role: "user", content: text }, baseDir);

  for (let i = 0; i < maxIterations; i++) {
    logger.debug(`Agent loop 第 ${i + 1}/${maxIterations} 轮`, { userId });

    const messages = get(sessionId, userId, {
      systemPrompt: opts?.systemPrompt,
      skipAttention: opts?.skipAttention,
      baseDir,
    });

    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model: opts?.model || config.deepseek.model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
        tool_choice: "auto",
        temperature: opts?.temperature || config.agent.temperature,
        max_tokens: opts?.maxTokens || config.agent.maxTokens,
        ...thinkParams(),
      } as any);
    } catch (err) {
      logger.error(`API 调用失败 (round ${i + 1})`, { error: String(err) });
      return qaFallback(text, get(sessionId, userId, { baseDir }));
    }

    const choice = response.choices[0];
    if (!choice) {
      logger.warn("AI 响应为空", { userId });
      return qaFallback(text, get(sessionId, userId, { baseDir }));
    }

    const msg = choice.message;

    // 无工具调用 → 持久化并返回最终回复
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const reply = msg.content || FALLBACK_EMPTY_REPLY;
      if (opts?.persistToolCalls !== false) {
        const finalMsg = { ...msg, role: "assistant", content: reply } as unknown as StoredMessage;
        sessionSet(sessionId, finalMsg, baseDir);
      }
      return reply;
    }

    // 工具调用 → 持久化 assistant 消息 + tool 结果，下一轮 get() 自然包含
    logger.debug(`AI 调用了 ${msg.tool_calls.length} 个工具`, {
      userId,
      tools: msg.tool_calls.map((t) => t.function.name),
    });

    if (opts?.persistToolCalls !== false) {
      const tcMsg = { ...msg, role: "assistant" } as unknown as StoredMessage;
      sessionSet(sessionId, tcMsg, baseDir);
    }

    for (const tc of msg.tool_calls) {
      const toolName = tc.function.name;
      const args = JSON.parse(tc.function.arguments);

      const progressText = TOOL_PROGRESS[toolName];
      if (onProgress && progressText) {
        const detail = args.query || args.title || args.titleOrId || "";
        onProgress(toolName, detail ? `${progressText} ${detail}` : progressText);
      }

      let toolResult: unknown;
      try {
        toolResult = await execute(toolName, args);
      } catch (err) {
        toolResult = { error: `工具执行出错：${String(err)}` };
        logger.warn(`工具 ${toolName} 执行失败`, { error: String(err) });
      }

      if (opts?.persistToolCalls !== false) {
        const toolMsg: StoredMessage = {
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult).slice(0, TOOL_RESULT_MAX_CHARS),
        };
        sessionSet(sessionId, toolMsg, baseDir);
      }
    }
  }

  // 达到最大轮次 → 不补 system，直接兜底
  logger.warn(`Agent loop 达到最大迭代次数 ${maxIterations}`, { userId });
  return FALLBACK_ALL_DONE;
}

/** 从环境变量构建 thinking 参数 */
function thinkParams(): Record<string, unknown> {
  const mode = process.env.AGENT_THINK_MODE || "non-thinking";
  if (mode === "non-thinking") return { thinking: { type: "disabled" } };
  return {
    thinking: { type: "enabled" },
    reasoning_effort: mode === "thinking_max" ? "max" : "high",
  };
}
