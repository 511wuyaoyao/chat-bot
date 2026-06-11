/**
 * 执行 Agent（Exec Agent）
 * 拿到 plan → 调用全部工具 → 返回结果摘要
 * 每次调用独立会话，不维护长上下文
 * 支持独立模型和参数（.env EXEC_MODEL / EXEC_TEMPERATURE / EXEC_MAX_TOKENS / EXEC_MAX_ITERATIONS）
 */

import { agentLoop, ProgressCallback } from "../../agent-loop";
import { toolRegistry } from "../../tool-registry";
import { getExecTools } from "./tools";
import { config } from "../../../config";
import { PROMPT_EXEC } from "../../../messages";

export async function execAgent(
  userId: string,
  _parentSessionId: string,
  plan: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const sessionId = `${userId}_exec_${Date.now()}`;

  return agentLoop(sessionId, userId, plan, onProgress, {
    systemPrompt: PROMPT_EXEC,
    tools: getExecTools(),
    executeTool: (name, args) => toolRegistry.execute(name, args, userId),
    skipAttention: true,
    maxIterations: config.exec.maxIterations,
    model: config.exec.model || undefined,
    temperature: config.exec.temperature || undefined,
    maxTokens: config.exec.maxTokens || undefined,
  });
}
