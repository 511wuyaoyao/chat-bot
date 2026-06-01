/**
 * Agent System Prompt 构建器
 * 角色定义 + 回复风格固定，工具列表和使用指南从 toolRegistry 动态注入
 */

import { PreClassifyHint } from "../router/pre-classify";
import { toolRegistry } from "./tool-registry";
import { PROMPT_CORE, PROMPT_RULES } from "../messages";

/** 角色定义 + 通用规则（与具体工具无关） */
function buildToolList(): string {
  const defs = toolRegistry.getDefinitions();
  return defs
    .map((t) => `- **${t.function.name}** — ${t.function.description}`)
    .join("\n");
}

/** 从 toolRegistry 动态收集工具使用指南 */
function buildUsageGuides(): string {
  const guides = toolRegistry.getUsageGuides();
  if (guides.length === 0) return "";
  return "\n\n## 工具使用指南\n" + guides.join("\n\n");
}

/**
 * 构建 Agent System Prompt
 * @param hint 预分类提示（可为 null）
 */
export function buildSystemPrompt(hint: PreClassifyHint | null): string {
  const toolList = buildToolList();
  const usageGuides = buildUsageGuides();
  let prompt = PROMPT_CORE + "\n\n## 可用工具\n" + toolList + usageGuides + PROMPT_RULES;

  if (hint) {
    let hintText = `\n\n## 预分类提示\n规则匹配推测用户意图为 "${hint.intent}"`;
    if (hint.scene) {
      hintText += `，场景 "${hint.scene}"`;
    }
    hintText += "。仅供参考，请根据实际消息内容自行判断。";
    prompt += hintText;
  }

  return prompt;
}
