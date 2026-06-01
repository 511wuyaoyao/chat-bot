/**
 * 消息模板构建器
 * 统一管理回复消息的格式
 */

import { EntryIndex } from "../data/index-types";

/** 创建确认 */
export function buildCreateConfirm(title: string, folderPath: string, fileName: string): string {
  const path = `${folderPath}/${fileName}`;
  return `已记到 ${path} ✅`;
}

/** 查询结果 — 单条详情 */
export function buildEntryDetail(entry: EntryIndex): string {
  const s: Record<string, string> = { " ": "⬜", "~": "🔄", x: "✅", "-": "🚫", "?": "❓" };
  const icon = s[entry.statusChar] || "⬜";
  const parts = [`${icon} ${entry.title}`];
  if (entry.url) parts.push(`链接：${entry.url}`);
  if (entry.progress) parts.push(`进度：${entry.progress}`);
  if (entry.deadline) parts.push(`截止：${entry.deadline}`);
  if (entry.note) parts.push(`备注：${entry.note}`);
  parts.push(`📁 ${entry.folderPath || "默认"}/${entry.fileName}`);
  return parts.join("\n");
}

/** 查询结果 — 列表 */
export function buildEntryList(entries: EntryIndex[]): string {
  const s: Record<string, string> = { " ": "⬜", "~": "🔄", x: "✅", "-": "🚫", "?": "❓" };
  return entries.map((e) => `${s[e.statusChar] || "⬜"} ${e.title}`).join("\n");
}

/** 推荐列表 */
export function buildRecommendList(items: { title: string; progress?: string | null }[], scene: string): string {
  const emoji: Record<string, string> = { boredom: "🎬", hungry: "🍔", learn: "📚" };
  return items.map((item) => {
    const extra = item.progress ? ` (${item.progress})` : "";
    return `${emoji[scene] || "📌"} ${item.title}${extra}`;
  }).join("\n");
}

/** 提醒消息 */
export function buildReminder(title: string, remindDescription: string): string {
  return `⏰ ${remindDescription}：${title}`;
}

/** 过期通知 */
export function buildExpiryNotice(title: string, overdueDays: number): string {
  return `「${title}」过了 ${overdueDays} 天，还需要做吗？`;
}

/** 每日汇总 */
export function buildDailySummary(
  todayDeadlines: EntryIndex[],
  overdue: EntryIndex[]
): string {
  const parts: string[] = ["☀️ 今日汇总"];

  if (todayDeadlines.length > 0) {
    parts.push("\n📅 今日待办：");
    todayDeadlines.forEach((e) => parts.push(`  ⬜ ${e.title}`));
  }

  if (overdue.length > 0) {
    parts.push("\n⚠️ 已过期：");
    overdue.forEach((e) => parts.push(`  ❗ ${e.title}`));
  }

  return parts.join("\n");
}
