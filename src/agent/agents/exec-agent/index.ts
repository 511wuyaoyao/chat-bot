/**
 * 执行 Agent（Exec Agent）
 * 拿到 plan → 调用全部工具 → 返回结果摘要
 * 上下文存储在父会话的 exec/context.json
 * 支持独立模型和参数（.env EXEC_MODEL / EXEC_TEMPERATURE / EXEC_MAX_TOKENS / EXEC_MAX_ITERATIONS）
 */

import path from "path";
import { agentLoop, ProgressCallback } from "../../agent-loop";
import { toolRegistry } from "../../tool-registry";
import { getExecTools } from "./tools";
import { config } from "../../../config/output";
import { buildPromptExec } from "../../../prompt";

const DATA_ROOT = path.resolve(process.cwd(), "data");

export async function execAgent(
  userId: string,
  parentSessionId: string,
  plan: string,
  onProgress?: ProgressCallback,
  signal?: AbortSignal
): Promise<string> {
  const sessionId = `${parentSessionId}_exec`;
  const storageDir = path.join(DATA_ROOT, userId, "session", parentSessionId, "exec");
  const tools = getExecTools();

  return agentLoop(sessionId, userId, plan, onProgress, {
    systemPrompt: buildPromptExec(tools),
    tools,
    executeTool: (name, args) => toolRegistry.execute(name, args, userId),
    actor: "exec-agent",
    mainSessionId: parentSessionId,
    storageDir,
    maxIterations: config.exec.maxIterations,
    model: config.exec.model,
    temperature: config.exec.temperature,
    maxTokens: config.exec.maxTokens,
    signal,
  });
}

