/**
 * 执行 Agent 工具选单
 * 从全局工具目录选取执行 Agent 需要的工具
 */

import { toolRegistry, ToolDefinition } from "../../tool-registry";

/** 执行 Agent 选用 */
const SELECTED = [
  "tavily_search",
  "get_entry",
  "get_tree",
  "add_schedule",
  "update_schedule",
  "delete_schedule",
  "query_schedules",
];

export function getExecTools(): ToolDefinition[] {
  return SELECTED.map((name) => {
    const def = toolRegistry.getDefinitions().find((d) => d.function.name === name);
    if (!def) throw new Error(`执行 Agent 选用了未注册的工具: ${name}`);
    return def;
  });
}
