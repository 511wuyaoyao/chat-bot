/**
 * 主 Agent（Chat Agent）
 * 只做一件事：拿到对话 → 调工具 → 返回回复
 * 对 topic-agent / exec-agent 完全无感
 * 上下文存储在 session/{sessionId}/main/
 */

import path from "path";
import { agentLoop, ProgressCallback } from "../../agent-loop";
import { AttentionRuntimeContext } from "../../attention";
import { getMainTools, executeMainTool } from "./tools";
import { buildPromptMain } from "../../../prompt";
import { latestAssistantUsageSince } from "../../../router/session/set";
import { maybeCompactContext } from "../../../router/session/context-manager";
import { config } from "../../../config";

const DATA_ROOT = path.resolve(process.cwd(), "data");

export async function mainAgent(
  sessionId: string,
  userId: string,
  text: string,
  onProgress?: ProgressCallback,
  messageId?: number,
  attentionContext?: AttentionRuntimeContext,
  signal?: AbortSignal
): Promise<string> {
  const storageDir = path.join(DATA_ROOT, userId, "session", sessionId, "main");
  const startedAt = Date.now();
  const tools = getMainTools();

  const reply = await agentLoop(sessionId, userId, text, onProgress, {
    systemPrompt: buildPromptMain(tools),
    tools,
    executeTool: (name, args, toolSignal) => executeMainTool(name, args, userId, sessionId, onProgress, toolSignal),
    actor: "main-agent",
    mainSessionId: sessionId,
    storageDir,
    maxIterations: config.main.maxIterations,
    model: config.main.model,
    temperature: config.main.temperature,
    maxTokens: config.main.maxTokens,
    messageId,
    attentionContext,
    signal,
  });

  const usage = latestAssistantUsageSince(sessionId, startedAt, storageDir);
  if (usage) {
    maybeCompactContext({
      sessionId,
      actor: "main-agent",
      usage,
      baseDir: storageDir,
    });
  }

  return reply;
}
