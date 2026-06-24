/**
 * Agent System Prompt 构建器
 * 角色定义 + 回复风格固定，工具列表和使用指南从 toolRegistry 动态注入
 */

import { toolRegistry } from "../../../agent/tool-registry";
import { PROMPT_CORE, PROMPT_DATA_MODEL, PROMPT_REMINDER_HANDLING, PROMPT_RULES, PROMPT_PROACTIVE_SYSTEM } from "../../../prompt";

/** 构建可用工具列表（纯文本，不用 markdown） */
function buildToolList(): string {
  const defs = toolRegistry.getDefinitions();
  return defs
    .map((t) => `${t.function.name}：${t.function.description}`)
    .join("\n");
}

/** 从 toolRegistry 动态收集工具使用指南 */
function buildUsageGuides(): string {
  const guides = toolRegistry.getUsageGuides();
  if (guides.length === 0) return "";
  return "\n\n工具使用指南\n" + guides.join("\n\n");
}

/** 构建 Agent System Prompt */
export function buildSystemPrompt(): string {
  const toolList = buildToolList();
  const usageGuides = buildUsageGuides();
  return PROMPT_CORE + "\n" + PROMPT_DATA_MODEL + "\n" + PROMPT_REMINDER_HANDLING + "\n" + PROMPT_PROACTIVE_SYSTEM + "\n\n可用工具\n" + toolList + usageGuides + PROMPT_RULES;
}
