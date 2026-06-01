/**
 * 每日汇总（09:00 触发）
 * 收集当日待办 + 过期任务，构建汇总消息
 */

import { getAllEntries } from "../data/file-engine";
import { todayStr, daysBetween } from "../utils/time-utils";
import { logger } from "../utils/logger";
import type { SendFn } from "./reminder";

/** 检查是否到了推送时间 */
let lastSummaryDate = "";

export function checkDailySummary(userId: string, sendFn: SendFn): void {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const today = todayStr();

  // 09:00 ~ 09:05 窗口内，且今天还没推送过
  if (hour !== 9 || minute > 5) return;
  if (lastSummaryDate === today) return;
  lastSummaryDate = today;

  const entries = getAllEntries(userId);
  const todayDeadlines = entries.filter((e) => {
    if (!e.deadline) return false;
    if (["x", "-"].includes(e.statusChar)) return false;
    return e.deadline.startsWith(today);
  });

  const overdue = entries.filter((e) => {
    if (!e.deadline) return false;
    if (["x", "-"].includes(e.statusChar)) return false;
    const deadlineDate = e.deadline.slice(0, 10);
    return daysBetween(deadlineDate, today) > 0;
  });

  if (todayDeadlines.length === 0 && overdue.length === 0) return;

  const parts: string[] = ["☀️ 今日汇总"];

  if (todayDeadlines.length > 0) {
    parts.push("\n📅 今日待办：");
    todayDeadlines.forEach((e) => parts.push(`  ⬜ ${e.title}`));
  }

  if (overdue.length > 0) {
    parts.push("\n⚠️ 已过期：");
    overdue.slice(0, 5).forEach((e) => {
      const days = daysBetween(e.deadline!.slice(0, 10), today);
      parts.push(`  ❗ ${e.title}（${days}天前）`);
    });
  }

  const message = parts.join("\n");
  sendFn(userId, message);
  logger.info(`每日汇总推送`, { userId, todayDeadlines: todayDeadlines.length, overdue: overdue.length });
}
