/**
 * Agent 主循环
 * session 层负责持久化历史；本轮运行期间维护临时 messages[]，确保动态 attention
 * 只注入一次，并位于当前用户消息之前。
 */

import OpenAI from "openai";
import { getLlmClient } from "./llm-client";
import { toolRegistry, ToolDefinition } from "./tool-registry";
import { qaFallback } from "./qa-fallback";
import { config } from "../config";
import { logger } from "../utils/logger";
import { get } from "../router/session/get";
import { set as sessionSet, recallUserMessage } from "../router/session/set";
import { StoredMessage } from "../router/session/utils/types";
import { ensureDir } from "../router/session/utils/storage";
import { isRecalled } from "../router/message-queue";
import { AttentionRuntimeContext, buildAttention } from "./attention/index";
import { emitTransactionEvent } from "./transaction-event";
import { addDebugTraceEvent, createDebugTrace, finishDebugTrace } from "../debug/trace-store";
import { recordTokenUsage } from "./token-usage";
import {
  TOOL_PROGRESS,
  buildAttentionSystemContent,
  FALLBACK_EMPTY_REPLY,
  FALLBACK_ALL_DONE,
} from "../prompt";

export type ProgressCallback = (toolName: string, description: string) => void;

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
    /** TransactionEvent 归属名 */
    actor?: "main-agent" | "topic-agent" | "exec-agent" | string;
    /** 主会话 ID；子 Agent 可传父会话 ID */
    mainSessionId?: string;
    /** 是否持久化 tool_calls 到 context，默认 true */
    persistToolCalls?: boolean;
    /** 覆写存储目录（用于 main/ topic/ 子目录场景），不传则使用默认 sessionDir(sessionId) */
    storageDir?: string;
    /** 用户消息的 QQ message_id，用于撤回定位 */
    messageId?: number;
    /** attention 运行时上下文，用于注入本轮消息来源等短期信息 */
    attentionContext?: AttentionRuntimeContext;
  }
): Promise<string> {
  const client = getLlmClient();
  const maxIterations = opts?.maxIterations ?? config.agent.maxIterations;
  const tools = opts?.tools ?? toolRegistry.getDefinitions();
  const execute = opts?.executeTool ?? ((name, args) => toolRegistry.execute(name, args, userId));

  const baseDir = opts?.storageDir;
  const actor = opts?.actor ?? "agent";
  const mainSessionId = opts?.mainSessionId ?? mainSessionIdOf(sessionId);

  // 确保 session 目录存在
  ensureDir(sessionId, baseDir);
  emitTransactionEvent({
    type: "agent.started",
    actor,
    userId,
    sessionId,
    mainSessionId,
  });

  /** 检查当前消息是否已被撤回，若是则回滚并中止 */
  function checkRecalled(): boolean {
    if (opts?.messageId && isRecalled(opts.messageId)) {
      recallUserMessage(sessionId, opts.messageId, baseDir);
      return true;
    }
    return false;
  }

  const messages = get(sessionId, userId, {
    systemPrompt: opts?.systemPrompt,
    baseDir,
  });
  const attentionText = buildAttention(userId, sessionId, opts?.attentionContext);
  if (attentionText) {
    messages.push({
      role: "system",
      content: buildAttentionSystemContent(attentionText),
    });
  }
  const userMsg: StoredMessage = { role: "user", content: text };
  messages.push(userMsg);

  // 组装完本轮 API 输入后再持久化用户消息，避免 latest user 出现在 attention 之前。
  sessionSet(sessionId, { role: "user", content: text, message_id: opts?.messageId }, baseDir);

  if (checkRecalled()) return "";

  for (let i = 0; i < maxIterations; i++) {
    logger.debug(`Agent loop 第 ${i + 1}/${maxIterations} 轮`, { userId });

    let response: OpenAI.Chat.Completions.ChatCompletion;
    const model = opts?.model || config.deepseek.model;
    const temperature = opts?.temperature || config.agent.temperature;
    const maxTokens = opts?.maxTokens || config.agent.maxTokens;
    const traceId = createDebugTrace({
      actor,
      userId,
      sessionId,
      mainSessionId,
      round: i + 1,
      model,
      params: {
        temperature,
        max_tokens: maxTokens,
        tool_choice: "auto",
        think: thinkParams(),
      },
      messages: structuredCloneSafe(messages),
      tools: structuredCloneSafe(tools),
    });

    try {
      response = await client.chat.completions.create({
        model,
        messages: messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
        tool_choice: "auto",
        temperature,
        max_tokens: maxTokens,
        ...thinkParams(),
      } as any);
    } catch (err) {
      logger.error(`API 调用失败 (round ${i + 1})`, { error: String(err) });
      finishDebugTrace(traceId, { status: "failed", error: String(err) });
      return qaFallback(text, get(sessionId, userId, { baseDir }));
    }
    finishDebugTrace(traceId, {
      status: "completed",
      response: structuredCloneSafe(response),
      finishReason: response.choices[0]?.finish_reason ?? null,
      usage: response.usage,
    });
    recordTokenUsage({
      userId,
      mainSessionId,
      actor,
      usage: response.usage,
    });

    const choice = response.choices[0];
    if (!choice) {
      logger.warn("AI 响应为空", { userId });
      finishDebugTrace(traceId, { status: "failed", error: "AI 响应为空" });
      return qaFallback(text, get(sessionId, userId, { baseDir }));
    }

    const msg = choice.message;

    // 无工具调用 → 持久化并返回最终回复
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      if (checkRecalled()) return "";
      const reply = msg.content || FALLBACK_EMPTY_REPLY;
      if (opts?.persistToolCalls !== false) {
        const finalMsg = {
          ...msg,
          role: "assistant",
          content: reply,
          usage: structuredCloneSafe(response.usage || {}),
          finish_reason: choice.finish_reason ?? null,
          model,
        } as unknown as StoredMessage;
        sessionSet(sessionId, finalMsg, baseDir);
      }
      emitTransactionEvent({
        type: "agent.completed",
        actor,
        userId,
        sessionId,
        mainSessionId,
        reply,
      });
      return reply;
    }

    // 工具调用 → 持久化 assistant 消息 + tool 结果，下一轮 get() 自然包含
    if (checkRecalled()) return "";
    logger.debug(`AI 调用了 ${msg.tool_calls.length} 个工具`, {
      userId,
      tools: msg.tool_calls.map((t) => t.function.name),
    });

    if (opts?.persistToolCalls !== false) {
      const tcMsg = {
        ...msg,
        role: "assistant",
        usage: structuredCloneSafe(response.usage || {}),
        finish_reason: choice.finish_reason ?? null,
        model,
      } as unknown as StoredMessage;
      sessionSet(sessionId, tcMsg, baseDir);
    }
    messages.push({ ...msg, role: "assistant" } as unknown as StoredMessage);

    for (const tc of msg.tool_calls) {
      const toolName = tc.function.name;
      let args: Record<string, unknown> = {};
      let toolResult: unknown;

      try {
        args = JSON.parse(tc.function.arguments || "{}");
        emitTransactionEvent({
          type: "tool.started",
          actor,
          userId,
          sessionId,
          mainSessionId,
          toolName,
          args,
        });
        addDebugTraceEvent(traceId, "tool.started", { toolName, args });

        const progressText = TOOL_PROGRESS[toolName];
        if (onProgress && progressText) {
          const detail = args.query || args.title || args.titleOrId || "";
          onProgress(toolName, detail ? `${progressText} ${detail}` : progressText);
        }

        toolResult = await execute(toolName, args);
        emitTransactionEvent({
          type: "tool.completed",
          actor,
          userId,
          sessionId,
          mainSessionId,
          toolName,
          args,
          result: toolResult,
        });
        addDebugTraceEvent(traceId, "tool.completed", { toolName, args, result: toolResult });
      } catch (err) {
        toolResult = { error: `工具调用失败：${String(err)}` };
        logger.warn(`工具 ${toolName} 执行失败`, { error: String(err) });
        emitTransactionEvent({
          type: "tool.failed",
          actor,
          userId,
          sessionId,
          mainSessionId,
          toolName,
          args,
          error: String(err),
          result: toolResult,
        });
        addDebugTraceEvent(traceId, "tool.failed", { toolName, args, error: String(err), result: toolResult });
      }

      if (opts?.persistToolCalls !== false) {
        const toolMsg: StoredMessage = {
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult).slice(0, config.agent.maxToolResultChars),
        };
        sessionSet(sessionId, toolMsg, baseDir);
        messages.push(toolMsg);
      } else {
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult).slice(0, config.agent.maxToolResultChars),
        });
      }
    }
  }

  // 达到最大轮次 → 不补 system，直接兜底
  logger.warn(`Agent loop 达到最大迭代次数 ${maxIterations}`, { userId });
  emitTransactionEvent({
    type: "agent.failed",
    actor,
    userId,
    sessionId,
    mainSessionId,
    error: `max_iterations:${maxIterations}`,
  });
  return FALLBACK_ALL_DONE;
}

function mainSessionIdOf(sessionId: string): string {
  return sessionId.replace(/_(topic|exec)$/, "");
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
