/**
 * 重复任务生成（5min 轮询）
 * 检查过期但未重新生成提醒的重复任务
 */

import { getAllEntries, updateEntry } from "../data/file-engine";
import { nowISO } from "../utils/time-utils";
import { logger } from "../utils/logger";

export function checkRecurring(userId: string): void {
  const entries = getAllEntries(userId);

  for (const entry of entries) {
    if (!entry.repeatRule) continue;
    if (!entry.reminded) continue;
    if (!entry.remindAt) continue;

    // 如果提醒已过期且已标记为 reminded，需要生成下一次
    if (entry.remindAt < nowISO()) {
      // 简单处理：刷新 reminded 状态，让 reminder.ts 下次触发
      updateEntry(userId, entry.id, { reminded: false });
      logger.debug(`重复任务刷新: ${entry.title}`);
    }
  }
}
