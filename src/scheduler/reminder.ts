/**
 * 提醒检查（15s 轮询）
 * 遍历待提醒条目，remindAt 到期则推送并标记已提醒
 */

import { getReminders, markReminded, updateEntry } from "../data/file-engine";
import { formatRemindAt, nowISO } from "../utils/time-utils";
import { logger } from "../utils/logger";

export type SendFn = (userId: string, message: string) => Promise<void>;

export function checkReminders(userId: string, sendFn: SendFn): void {
  const reminders = getReminders(userId);

  for (const entry of reminders) {
    if (!entry.remindAt) continue;
    if (entry.remindAt > nowISO()) continue;

    const message = `提醒：${formatRemindAt(entry.remindAt)} — ${entry.title}`;
    sendFn(userId, message);
    markReminded(userId, entry.id);

    // 如果有重复规则，计算下一次提醒
    if (entry.repeatRule) {
      const nextRemind = calcNextRepeat(entry.repeatRule, entry.remindAt);
      if (nextRemind) {
        updateEntry(userId, entry.id, { remindAt: nextRemind, reminded: false });
        logger.debug(`重复任务下次提醒: ${entry.title} → ${nextRemind}`);
      }
    }

    logger.info(`推送提醒: ${entry.title}`, { userId, id: entry.id });
  }
}

/** 简单的重复时间计算（仅支持部分格式） */
function calcNextRepeat(rule: string, currentAt: string): string | null {
  const current = new Date(currentAt);
  if (isNaN(current.getTime())) return null;

  // "每周五 14:00"
  const weeklyMatch = rule.match(/每周(一|二|三|四|五|六|日)\s*(\d{1,2}:\d{2})/);
  if (weeklyMatch) {
    const dayMap: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0 };
    const targetDay = dayMap[weeklyMatch[1]];
    const time = weeklyMatch[2];
    const next = new Date(current);
    next.setDate(next.getDate() + 7);
    next.setHours(parseInt(time.split(":")[0]), parseInt(time.split(":")[1]), 0, 0);

    // 确保是目标星期几
    while (next.getDay() !== targetDay) {
      next.setDate(next.getDate() + 1);
    }

    return next.toISOString().replace("T", " ").slice(0, 16);
  }

  // "每天 09:00"
  const dailyMatch = rule.match(/每天\s*(\d{1,2}:\d{2})/);
  if (dailyMatch) {
    const time = dailyMatch[1];
    const next = new Date(current);
    next.setDate(next.getDate() + 1);
    next.setHours(parseInt(time.split(":")[0]), parseInt(time.split(":")[1]), 0, 0);
    return next.toISOString().replace("T", " ").slice(0, 16);
  }

  return null;
}
