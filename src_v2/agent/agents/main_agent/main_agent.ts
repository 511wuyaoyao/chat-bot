/**
 * 主 Agent（Chat Agent）
 * 拥有全部工具。简单任务直接调工具链，复杂任务写 plan → delegate 给 Exec Agent
 * 上下文干净：只存用户消息和最终回复，工具调用过程不落盘
 * 注意力层透明注入，主 Agent 不感知记忆管理
 */

import { agentLoop, AgentLoopConfig } from "../../agent-loop";
import { execAgent } from "../exec_agent/exec_agent";
import { topicAgent } from "../topic_agent/topic_agent";
import { buildAttention } from "../../attention_prompt/index";
import { toolRegistry, ToolDefinition } from "../../../../src/agent/tool-registry";
import { config as appConfig } from "../../../../src/config";
import { logger } from "../../../../src/utils/logger";

const PROMPT_MAIN = `你是用户的个人助理，拥有完整的工具集。你专注于与用户对话和决策。

任务分级
- 简单任务（单步或双步操作）→ 直接调工具完成，自己写回复
  例："记一下今天的会议" → add_entry → 直接回复
  例："最近有什么电影新闻" → web_search → 直接回复
- 复杂任务（需要多步规划、跨系统操作）→ 先思考步骤，用 delegate 把计划交给执行助理
  例："整理我所有电影的观看状态，搜索可能有兴趣的新片" → delegate(plan)

Plan 写法
把复杂任务拆成明确的步骤列表，每一步说清楚做什么、用什么思路。
执行助理会按步骤逐一完成并返回结果，你拿到结果后审视是否完整，再给用户自然回复。

回复风格
专业、直接、克制。不卖萌不客套。
禁止 markdown、emoji、波浪号、俏皮语气词（呀、哦、呢、嘛、哟、哈、嘿、啦、喔、诶、吧）。
用陈述句直接回答，不超过 200 字。`;

const DELEGATE_DEF: ToolDefinition = {
  type: "function",
  function: {
    name: "delegate",
    description:
      "将复杂多步任务委派给执行助理。仅在任务需要多个工具、多个步骤协调时使用。" +
      "简单的一两步操作请直接调工具，不要委派。",
    parameters: {
      type: "object",
      properties: {
        plan: {
          type: "string",
          description: "执行计划，编号列出每一步要做什么，每步说清目标和涉及的工具思路",
        },
      },
      required: ["plan"],
    },
  },
};

export async function mainAgent(
  sessionId: string,
  userId: string,
  text: string,
  onProgress?: (toolName: string, desc: string) => void
): Promise<string> {
  // 主 Agent 拥有全部工具 + delegate
  const allTools = toolRegistry.getDefinitions();
  const tools: ToolDefinition[] = [...allTools, DELEGATE_DEF];

  const systemPrompt = [PROMPT_MAIN, buildAttention(userId)]
    .filter(Boolean)
    .join("\n\n");

  const cfg: AgentLoopConfig = {
    sessionId,
    userId,
    text,
    systemPrompt,
    tools,
    executeTool: async (name, args) => {
      // 全量工具 → 走 toolRegistry
      if (toolRegistry.has(name)) {
        return await toolRegistry.execute(name, args, userId);
      }
      // delegate → 启动 Exec Agent
      if (name === "delegate") {
        onProgress?.(name, "执行计划");
        return { result: await execAgent(userId, String(args.plan), onProgress) };
      }
      return { error: `未知工具 ${name}` };
    },
    onProgress,
    persistToolCalls: false, // 工具过程不写入主会话，对抗噪声
    thinkingMode: "enabled", // Plan + Reflect 在思维链中自然发生
    maxIterations: appConfig.agent.maxIterations,
  };

  const reply = await agentLoop(cfg);

  // Topic Agent 静默运行
  try {
    const dialogue = `用户：${text}\n助手：${reply}`;
    await topicAgent(userId, dialogue);
  } catch (err) {
    logger.debug("Topic Agent 静默失败", { error: String(err) });
  }

  return reply;
}
