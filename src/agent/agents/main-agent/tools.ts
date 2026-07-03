/**
 * 主 Agent 工具选单
 * 从全局工具目录选取 + 自有 delegate 工具
 */

import { toolRegistry, ToolDefinition } from "../../tool-registry";
import { execAgent } from "../exec-agent/index";
import { ProgressCallback } from "../../agent-loop";

/** 主 Agent 选用 */
const SELECTED = [
  "deepseek_web_search",
  "get_entry",
  "get_tree",
  "add_schedule",
  "update_schedule",
  "delete_schedule",
  "query_schedules",
];

/** delegate 工具定义（主 Agent 自有，不在全局目录中） */
const DELEGATE_DEF: ToolDefinition = {
  type: "function",
  function: {
    name: "delegate",
    description:
      "将复杂多步任务委派给执行助理。仅在任务需要多个工具、多个步骤协调时使用。" +
      "简单操作直接调工具即可，不要委派。",
    parameters: {
      type: "object",
      properties: {
        plan: {
          type: "string",
          description: "执行计划，编号列出每一步做什么，说清目标和涉及的工具思路",
        },
      },
      required: ["plan"],
    },
  },
};

/** 获取主 Agent 的工具定义列表 */
export function getMainTools(): ToolDefinition[] {
  const defs: ToolDefinition[] = [];

  for (const name of SELECTED) {
    const def = toolRegistry.getDefinitions().find((d) => d.function.name === name);
    if (!def) throw new Error(`主 Agent 选用了未注册的工具: ${name}`);
    defs.push(def);
  }

  defs.push(DELEGATE_DEF);
  return defs;
}

/** 执行主 Agent 工具 */
export async function executeMainTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  sessionId: string,
  onProgress?: ProgressCallback
): Promise<unknown> {
  // 全局工具 → 委托给 toolRegistry
  if (SELECTED.includes(name)) {
    return toolRegistry.execute(name, args, userId);
  }

  // delegate → 启动执行 Agent（会话在父目录下）
  if (name === "delegate") {
    onProgress?.(name, "执行计划");
    return { result: await execAgent(userId, sessionId, String(args.plan), onProgress) };
  }

  return { error: `未知工具 ${name}` };
}
