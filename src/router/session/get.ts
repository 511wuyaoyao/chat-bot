/**
 * 上下文窗口构建
 * 返回：[system_prompt, ...history, attention]
 * 注意力消息不持久化，每次动态注入
 */

import { StoredMessage } from "./utils/types";
import { getCache } from "./set";
import { buildSystemPrompt } from "./utils/system-prompt";
import { buildTreeContext } from "./utils/tree-context";

/** 获取完整上下文窗口数组 */
export function get(sessionId: string, userId: string): StoredMessage[] {
  const history = getCache(sessionId);
  const systemContent = buildSystemPrompt();
  const attention = buildAttention(userId);

  const result: StoredMessage[] = [
    { role: "system", content: systemContent },
    ...history,
  ];
  if (attention) result.push(attention);

  return result;
}

/** 动态构建注意力消息（目录树 + 时间） */
function buildAttention(userId: string): StoredMessage | null {
  const tree = buildTreeContext(userId);
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const parts: string[] = [];
  if (tree) parts.push(tree);
  parts.push(`当前时间：${dateStr} ${timeStr}`);

  return { role: "assistant", content: parts.join("\n\n") };
}
