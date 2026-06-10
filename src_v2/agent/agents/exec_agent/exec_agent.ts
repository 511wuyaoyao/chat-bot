/**
 * 执行 Agent
 * 拿到任务描述 → 调用全部数据/日程/搜索工具 → 返回结果摘要
 * 独立上下文，用完即焚
 */

import { agentLoop } from "../../agent-loop";
import { toolRegistry } from "../../../../src/agent/tool-registry";
import { buildAttention } from "../../attention_prompt/index";
import { create } from "../../../../src/router/session/create";

const PROMPT_EXEC = `你是执行助理。你的任务是通过工具调用完成用户委派的具体操作。

核心规则
所有操作必须通过对应工具完成，禁止编造结果。

条目 vs 定时任务——务必区分：
- add_entry / update_entry 记录"什么东西"：电影、餐厅、书籍、技能等。存在目录树里。
- add_schedule / update_schedule 安排"什么时候"：定时任务(recurring)或一次任务(once)。存在 schedules.json。
- 用户说"记一下某电影" → add_entry。用户说"明天9点提醒我开会" → add_schedule。

数据架构
用户数据以树状结构存储，每个 .md 文件是一张表，每行一个条目。
目录树已注入上下文。分类名、字段名以用户使用习惯为准。同类条目保持字段一致。

工具调用
可以一次调用多个工具，也可以链式调用。工具返回错误时换种方式重试。
文件操作前先看目录树了解当前结构。
拿到所有需要的结果后，用自然中文给出简洁的操作总结（做了什么、结果如何）。`;

export async function execAgent(
  userId: string,
  task: string,
  onProgress?: (toolName: string, desc: string) => void
): Promise<string> {
  // 临时会话，不污染主对话
  const sessionId = `${userId}_exec_${Date.now()}`;
  create(sessionId, userId);

  const tools = toolRegistry.getDefinitions();

  const systemPrompt = [
    PROMPT_EXEC,
    buildAttention(userId),
  ].filter(Boolean).join("\n\n");

  const result = await agentLoop({
    sessionId,
    userId,
    text: task,
    systemPrompt,
    tools,
    executeTool: (name, args) => toolRegistry.execute(name, args, userId),
    onProgress,
    thinkingMode: "enabled",
    maxIterations: 8,
  });

  return result;
}
