/**
 * 主 Agent（Chat Agent）
 * 只做一件事：拿到对话 → 调工具 → 返回回复
 * 对 topic-agent / exec-agent 完全无感
 * 上下文存储在 session/{sessionId}/main/
 */

import path from "path";
import { agentLoop, ProgressCallback } from "../../agent-loop";
import { buildAttention } from "../../attention/index";
import { getMainTools, executeMainTool } from "./tools";
import { PROMPT_MAIN } from "../../../messages";

const DATA_ROOT = path.resolve(process.cwd(), "data");

export async function mainAgent(
  sessionId: string,
  userId: string,
  text: string,
  onProgress?: ProgressCallback
): Promise<string> {
  const systemPrompt = [PROMPT_MAIN, buildAttention(userId, sessionId)]
    .filter(Boolean)
    .join("\n\n");

  const storageDir = path.join(DATA_ROOT, userId, "session", sessionId, "main");

  return agentLoop(sessionId, userId, text, onProgress, {
    systemPrompt,
    tools: getMainTools(),
    executeTool: (name, args) => executeMainTool(name, args, userId, sessionId, onProgress),
    storageDir,
  });
}
