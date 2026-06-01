/**
 * Agent 主循环
 * 使用 DeepSeek function calling 实现工具调用循环：
 * 组装消息 → 调 AI → AI 决定调用工具 or 直接回复 → 循环直到 AI 回复或达到上限
 */

import OpenAI from "openai";
import { getLlmClient } from "./llm-client";
import { toolRegistry } from "./tool-registry";
import { buildSystemPrompt } from "./system-prompt";
import { qaFallback } from "./qa-fallback";
import { config } from "../config";
import { PreClassifyHint } from "../router/pre-classify";
import { logger } from "../utils/logger";
import {
  TOOL_PROGRESS,
  AGENT_FORCE_REPLY,
  AGENT_PLEASE_REPLY,
  FALLBACK_EMPTY_REPLY,
  FALLBACK_ALL_DONE,
} from "../messages";

interface ContextEntry {
  role: "user" | "assistant";
  content: string;
}

/** 进度回调：AI 调用工具时通知外部 */
export type ProgressCallback = (toolName: string, description: string) => void;

/** 工具结果最大字符数（防止 token 爆炸） */
const TOOL_RESULT_MAX_CHARS = 1500;

/**
 * Agent 主循环
 * @param userId QQ 用户 ID
 * @param text 用户消息文本
 * @param context 最近对话上下文
 * @param hint 预分类提示（可为 null）
 * @param onProgress 进度回调（可选），用于向 QQ 发送"正在搜索..."等过程消息
 * @returns 回复文本
 */
export async function agentLoop(
  userId: string,
  text: string,
  context: ContextEntry[],
  hint: PreClassifyHint | null,
  onProgress?: ProgressCallback
): Promise<string> {
  const client = getLlmClient();
  const maxIterations = config.agent.maxIterations;

  // 构建消息列表
  const systemContent = buildSystemPrompt(hint);
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
  ];

  // 注入对话上下文
  for (const entry of context) {
    messages.push({
      role: entry.role as "user" | "assistant",
      content: entry.content,
    });
  }

  // 注入当前用户消息
  messages.push({ role: "user", content: text });

  // 获取工具定义
  const tools = toolRegistry.getDefinitions();

  // 主循环
  for (let i = 0; i < maxIterations; i++) {
    logger.debug(`Agent loop 第 ${i + 1}/${maxIterations} 轮`, { userId });
    let response: OpenAI.Chat.Completions.ChatCompletion;
    try {
      response = await client.chat.completions.create({
        model: config.deepseek.model,
        messages,
        tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 1024,
      });
    } catch (err) {
      logger.error(`API 调用失败 (round ${i + 1})`, { error: String(err) });
      if (i < maxIterations - 1) {
        try {
          response = await client.chat.completions.create({
            model: config.deepseek.model,
            messages,
            tools: tools as OpenAI.Chat.Completions.ChatCompletionTool[],
            tool_choice: "auto",
            temperature: 0.3,
            max_tokens: 1024,
          });
        } catch {
          logger.warn("API 重试也失败了，回退到 QA 兜底", { userId });
          return qaFallback(text, context);
        }
      } else {
        return qaFallback(text, context);
      }
    }

    const choice = response.choices[0];
    if (!choice) {
      logger.warn("AI 响应为空", { userId });
      return qaFallback(text, context);
    }

    const msg = choice.message;

    // AI 选择直接回复（没调用工具）
    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      const reply = msg.content || "";
      if (!reply && i === 0) {
        messages.push({
          role: "user",
          content: AGENT_PLEASE_REPLY,
        });
        continue;
      }
      return reply || FALLBACK_EMPTY_REPLY;
    }

    // AI 调用了工具
    logger.debug(`AI 调用了 ${msg.tool_calls.length} 个工具`, {
      userId,
      tools: msg.tool_calls.map((t) => t.function.name),
    });

    // 将 assistant 消息（含 tool_calls）加入历史
    messages.push(msg as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);

    // 逐个执行工具
    for (const tc of msg.tool_calls) {
      const toolName = tc.function.name;
      const args = JSON.parse(tc.function.arguments);

      // 进度通知
      const progressText = TOOL_PROGRESS[toolName];
      if (onProgress && progressText) {
        const detail = args.query || args.title || args.titleOrId || "";
        const label = detail ? `${progressText} ${detail}` : progressText;
        onProgress(toolName, label);
      }

      let toolResult: unknown;
      try {
        toolResult = await toolRegistry.execute(toolName, args, userId);
      } catch (err) {
        toolResult = { error: `工具执行出错：${String(err)}` };
        logger.warn(`工具 ${toolName} 执行失败`, { error: String(err) });
      }

      // 将工具结果加入历史
      const resultStr = JSON.stringify(toolResult).slice(0, TOOL_RESULT_MAX_CHARS);
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: resultStr,
      } as OpenAI.Chat.Completions.ChatCompletionToolMessageParam);
    }
  }

  // 达到最大迭代次数 → 强制 AI 回复
  logger.warn(`Agent loop 达到最大迭代次数 ${maxIterations}`, { userId });
  messages.push({
    role: "system",
    content: AGENT_FORCE_REPLY,
  });

  try {
    const final = await client.chat.completions.create({
      model: config.deepseek.model,
      messages,
      temperature: 0.5,
      max_tokens: 512,
    });
    return final.choices[0]?.message?.content || FALLBACK_ALL_DONE;
  } catch {
    return FALLBACK_ALL_DONE;
  }
}
