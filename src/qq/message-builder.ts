/**
 * 消息模板构建器
 * 统一管理回复消息的格式，Claude Code 风格：纯文本，无 emoji，无 markdown
 */

import { TrackableEntry } from "../tools/data_tools/data_engine/entities";

/** 状态字符到文字标签的映射 */
const STATUS_LABEL: Record<string, string> = {
  " ": "待办",
  "~": "进行中",
  x:  "已完成",
  "-": "搁置",
  "?": "待确认",
};

/** 创建确认 */
export function buildCreateConfirm(title: string, folderPath: string, fileName: string): string {
  const path = `${folderPath}/${fileName}`;
  return `已记到 ${path}：${title}`;
}

/** 查询结果 — 单条详情 */
export function buildEntryDetail(entry: TrackableEntry): string {
  const status = STATUS_LABEL[entry.statusChar] || "待办";
  const parts = [`[${status}] ${entry.title}`];
  if (entry.url) parts.push(`链接：${entry.url}`);
  if (entry.progress) parts.push(`进度：${entry.progress}`);
  if (entry.deadline) parts.push(`截止：${entry.deadline}`);
  if (entry.note) parts.push(`备注：${entry.note}`);
  parts.push(`位置：${entry.folderPath || "默认"}/${entry.fileName}`);
  return parts.join("\n");
}

/** 查询结果 — 列表 */
export function buildEntryList(entries: TrackableEntry[]): string {
  return entries
    .map((e) => {
      const status = STATUS_LABEL[e.statusChar] || "待办";
      return `[${status}] ${e.title}`;
    })
    .join("\n");
}

/** 推荐列表 */
export function buildRecommendList(
  items: { title: string; progress?: string | null }[],
  scene: string
): string {
  const sceneLabel: Record<string, string> = {
    boredom: "娱乐",
    hungry: "美食",
    learn: "学习",
  };
  const label = sceneLabel[scene] || "收藏";
  return items
    .map((item) => {
      const extra = item.progress ? `（${item.progress}）` : "";
      return `[${label}] ${item.title}${extra}`;
    })
    .join("\n");
}

/** 提醒消息 */
export function buildReminder(title: string, remindDescription: string): string {
  return `提醒：${remindDescription} — ${title}`;
}

/** 过期通知 */
export function buildExpiryNotice(title: string, overdueDays: number): string {
  return `「${title}」已过期 ${overdueDays} 天，还需要继续吗？`;
}

/** 每日汇总 */
export function buildDailySummary(
  todayDeadlines: TrackableEntry[],
  overdue: TrackableEntry[]
): string {
  const parts: string[] = ["今日汇总"];

  if (todayDeadlines.length > 0) {
    parts.push("\n今日待办：");
    todayDeadlines.forEach((e) => parts.push(`  [待办] ${e.title}`));
  }

  if (overdue.length > 0) {
    parts.push("\n已过期：");
    overdue.forEach((e) => parts.push(`  [过期] ${e.title}`));
  }

  return parts.join("\n");
}
