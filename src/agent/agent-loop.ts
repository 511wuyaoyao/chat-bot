/**
 * Agent 涓诲惊鐜? * session 灞傝礋璐ｆ寔涔呭寲鍘嗗彶锛涙湰杞繍琛屾湡闂寸淮鎶や复鏃?messages[]锛岀‘淇濆姩鎬?attention
 * 鍙敞鍏ヤ竴娆★紝骞朵綅浜庡綋鍓嶇敤鎴锋秷鎭箣鍓嶃€? */

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

export type ProgressCallback = (toolName: string, description: string) => void | Promise<void>;

export async function agentLoop(
  sessionId: string,
  userId: string,
  text: string,
  onProgress?: ProgressCallback,
  opts?: {
    systemPrompt?: string;
    /** 鑷畾涔夊伐鍏烽泦锛屼笉浼犵敤鍏ㄥ眬 toolRegistry */
    tools?: ToolDefinition[];
    /** 鑷畾涔夊伐鍏锋墽琛屽櫒锛屽拰 tools 閰嶅 */
    executeTool?: (name: string, args: Record<string, unknown>, signal?: AbortSignal) => Promise<unknown>;
    /** 鏈€澶ц凯浠ｆ鏁帮紝涓嶄紶鐢ㄥ叏灞€閰嶇疆 */
    maxIterations?: number;
    /** 瑕嗗啓妯″瀷 */
    model?: string;
    /** 瑕嗗啓 temperature锛? 琛ㄧず涓嶈鍐?*/
    temperature?: number;
    /** 瑕嗗啓 maxTokens锛? 琛ㄧず涓嶈鍐?*/
    maxTokens?: number;
    /** TransactionEvent 褰掑睘鍚?*/
    actor?: "main-agent" | "topic-agent" | "exec-agent" | string;
    /** 涓讳細璇?ID锛涘瓙 Agent 鍙紶鐖朵細璇?ID */
    mainSessionId?: string;
    /** 鏄惁鎸佷箙鍖?tool_calls 鍒?context锛岄粯璁?true */
    persistToolCalls?: boolean;
    /** 瑕嗗啓瀛樺偍鐩綍锛堢敤浜?main/ topic/ 瀛愮洰褰曞満鏅級锛屼笉浼犲垯浣跨敤榛樿 sessionDir(sessionId) */
    storageDir?: string;
    /** 鐢ㄦ埛娑堟伅鐨?QQ message_id锛岀敤浜庢挙鍥炲畾浣?*/
    messageId?: number;
    /** attention 杩愯鏃朵笂涓嬫枃锛岀敤浜庢敞鍏ユ湰杞秷鎭潵婧愮瓑鐭湡淇℃伅 */
    attentionContext?: AttentionRuntimeContext;
    /** Abort current agent run on recall. */
    signal?: AbortSignal;
  }
): Promise<string> {
  const client = getLlmClient();
  const maxIterations = opts?.maxIterations ?? config.agent.maxIterations;
  const tools = opts?.tools ?? toolRegistry.getDefinitions();
  const signal = opts?.signal;
  const execute = opts?.executeTool ?? ((name, args) => toolRegistry.execute(name, args, userId));

  const baseDir = opts?.storageDir;
  const actor = opts?.actor ?? "agent";
  const mainSessionId = opts?.mainSessionId ?? mainSessionIdOf(sessionId);

  // 纭繚 session 鐩綍瀛樺湪
  ensureDir(sessionId, baseDir);
  emitTransactionEvent({
    type: "agent.started",
    actor,
    userId,
    sessionId,
    mainSessionId,
  });

  /** 妫€鏌ュ綋鍓嶆秷鎭槸鍚﹀凡琚挙鍥烇紝鑻ユ槸鍒欏洖婊氬苟涓 */
  function checkRecalled(): boolean {
    const recalled = opts?.messageId !== undefined && isRecalled(opts.messageId);
    if (signal?.aborted || recalled) {
      if (opts?.messageId !== undefined) recallUserMessage(sessionId, opts.messageId, baseDir);
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

  // Persist user message after attention is assembled.
  sessionSet(sessionId, {
    role: "user",
    content: text,
    message_id: opts?.messageId === undefined ? undefined : String(opts.messageId),
  }, baseDir);

  if (checkRecalled()) return "";

  for (let i = 0; i < maxIterations; i++) {
    logger.debug(`Agent loop round ${i + 1}/${maxIterations}`, { userId });

    let response: OpenAI.Chat.Completions.ChatCompletion;
    const model = opts?.model ?? config.deepseek.model;
    const temperature = opts?.temperature ?? config.agent.temperature;
    const maxTokens = opts?.maxTokens ?? config.agent.maxTokens;
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
      } as any, signal ? { signal } : undefined);
    } catch (err) {
      if (checkRecalled()) {
        finishDebugTrace(traceId, { status: "failed", error: "aborted" });
        return "";
      }
      logger.error(`API 璋冪敤澶辫触 (round ${i + 1})`, { error: String(err) });
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
      logger.warn("AI 鍝嶅簲涓虹┖", { userId });
      finishDebugTrace(traceId, { status: "failed", error: "AI 鍝嶅簲涓虹┖" });
      return qaFallback(text, get(sessionId, userId, { baseDir }));
    }

    const msg = choice.message;

    // Return final reply when no tool call is requested.
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

    // 宸ュ叿璋冪敤 鈫?鎸佷箙鍖?assistant 娑堟伅 + tool 缁撴灉锛屼笅涓€杞?get() 鑷劧鍖呭惈
    if (checkRecalled()) return "";
    logger.debug(`AI requested ${msg.tool_calls.length} tool calls`, {
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
        if (checkRecalled()) return "";
        if (onProgress && progressText) {
          const detail = args.query || args.title || args.titleOrId || "";
          await onProgress(toolName, detail ? `${progressText} ${detail}` : progressText);
        }
        if (checkRecalled()) return "";

        toolResult = await execute(toolName, args, signal);
        if (checkRecalled()) return "";
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
        toolResult = { error: `tool call failed: ${String(err)}` };
        logger.warn(`tool ${toolName} execution failed`, { error: String(err) });
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

  // Return fallback after max iterations.
  logger.warn(`Agent loop reached max iterations ${maxIterations}`, { userId });
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

/** 浠庣幆澧冨彉閲忔瀯寤?thinking 鍙傛暟 */
function thinkParams(): Record<string, unknown> {
  const mode = process.env.AGENT_THINK_MODE || "non-thinking";
  if (mode === "non-thinking") return { thinking: { type: "disabled" } };
  return {
    thinking: { type: "enabled" },
    reasoning_effort: mode === "thinking_max" ? "max" : "high",
  };
}

