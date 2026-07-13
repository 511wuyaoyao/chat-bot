/**
 * 工具相关消息 — 进度提示 + 使用指南
 */

import type { ToolDefinition } from "../agent/tool-registry";

export const TOOL_PROGRESS: Record<string, string> = {
  add_entry: "正在记录",
  update_entry: "正在更新",
  delete_entry: "正在删除",
  create_folder: "正在创建分类",
  delete_folder: "正在删除分类",
  delete_file: "正在删除文件",
  update_folder: "正在更新分类",
  get_tree: "正在查看",
  get_entry: "正在读取",
  deepseek_web_search: "正在搜索",
  tavily_search: "正在搜索",
  add_schedule: "正在设置提醒",
  update_schedule: "正在更新提醒",
  delete_schedule: "正在删除提醒",
  query_schedules: "正在查询提醒",
};

export const TOOL_GUIDE_ADD_ENTRY =
  "add_entry 使用原则\n" +
  "add_entry 用于记录内容（电影、餐厅、书籍、任务等），不是用于设置提醒。\n" +
  "用户说记一下xxx → add_entry 记录内容。\n" +
  "用户说明天x点提醒我xxx → add_schedule 设置提醒（必要时先 add_entry 再 add_schedule）。\n" +
  "fields 键值对用中文，由你自行决定。状态是普通中文字段，例如 状态：已解决，不使用 checkbox 表达状态。\n" +
  "常用参考：状态、备注、链接、兴趣度、进度。\n" +
  "同类条目保持字段一致。folderPath 和 fileName 根据内容分类。";

export const TOOL_GUIDE_UPDATE_ENTRY =
  "update_entry 自定义字段原则\n" +
  "fields 键值对用中文，只传需要修改的字段；工具会保留旧字段并合并修改。\n" +
  "状态是唯一权威状态字段，例如 状态：已解决，不使用 checkbox 表达状态。\n" +
  "interestDelta 用于增减兴趣度：用户喜欢 +25，不喜欢 -40，标记完成 -80。\n" +
  "观察用户对话中的偏好：用户反复问某类信息，下次同类条目主动带上对应字段。\n" +
  "同条目字段保持语义连贯。";

export const TOOL_GUIDE_SCHEDULE =
  "定时任务使用指南\n" +
  "定时任务独立于条目系统。type 选 recurring（定时任务，可重复）或 once（一次任务，触发即完成）。\n" +
  "用户提到具体时间+动作 → 明天9点叫我开会 → type=recurring/once, triggerAt=明天09:00。\n" +
  "用户只描述内容没有时间 → 用 add_entry，不要创建 schedule。\n" +
  "repeatRule 格式：daily:HH:mm / weekly:D:HH:mm（D: 0=周日…6=周六）。\n" +
  "recurring 触发后系统自动刷新，无需你操作。\n" +
  "once 触发后用户回应 → 立刻 delete_schedule 删除该一次任务。\n" +
  "联动：记一下明天开会 → 先 add_entry，再 add_schedule。";

export const PROMPT_REMINDER_HANDLING = `
任务响应规则
系统会通过对话上下文发送任务通知（定时任务或一次任务）。
用户回应后，立即处理关联的定时任务：
- once 任务 → 调 delete_schedule 删除
- recurring 任务 → 无需操作，系统已自动刷新
同时更新对应条目（调 update_entry）：
确认完成 → 状态 改为已完成/已去/已做等，interestDelta 传 -80
放弃 → 状态 改为搁置
模糊不清 → 追问确认意图

以上必须通过工具调用完成，回复简洁。`;

export function formatToolDefinitions(tools: ToolDefinition[]): string {
  if (tools.length === 0) return "- 当前没有注入工具定义。";

  return tools.map((tool) => {
    const fn = tool.function;
    const required = new Set(fn.parameters.required || []);
    const params = Object.entries(fn.parameters.properties || {})
      .map(([name, schema]) => {
        const desc = paramDescription(schema);
        const mark = required.has(name) ? "必填" : "可选";
        return `  - ${name}（${mark}）：${desc}`;
      });

    return [
      `- ${fn.name}：${fn.description}`,
      params.length > 0 ? params.join("\n") : "  - 无参数",
    ].join("\n");
  }).join("\n");
}

function paramDescription(schema: unknown): string {
  if (!schema || typeof schema !== "object") return "无描述";
  const obj = schema as { description?: unknown; enum?: unknown; type?: unknown };
  const parts: string[] = [];
  if (typeof obj.description === "string" && obj.description.trim()) {
    parts.push(obj.description.trim());
  }
  if (Array.isArray(obj.enum) && obj.enum.length > 0) {
    parts.push(`可选值：${obj.enum.map(String).join(" / ")}`);
  }
  if (parts.length === 0 && typeof obj.type === "string") {
    parts.push(`类型：${obj.type}`);
  }
  return parts.join("；") || "无描述";
}
