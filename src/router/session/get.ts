/**
 * 上下文窗口构建
 * 返回：[system_prompt, ...history, attention]
 * 注意力消息不持久化，每次动态注入
 */

import { StoredMessage } from "./utils/types";
import { getCache } from "./set";
import { buildSystemPrompt } from "./utils/system-prompt";
import { buildAttention } from "../../agent/attention/index";

/** 获取完整上下文窗口数组。baseDir 仅 agentLoop 内部使用 */
export function get(
  sessionId: string,
  userId: string,
  opts?: { systemPrompt?: string; skipAttention?: boolean; baseDir?: string }
): StoredMessage[] {
  const history = getCache(sessionId, opts?.baseDir);
  const systemContent = opts?.systemPrompt ?? buildSystemPrompt();

  const result: StoredMessage[] = [
    { role: "system", content: systemContent },
    ...history,
  ];

  if (!opts?.skipAttention) {
    const attentionText = buildAttention(userId, sessionId);
    if (attentionText) {
      result.push({ role: "assistant", content: attentionText });
    }
  }

  return result;
}
