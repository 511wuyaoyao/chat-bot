/**
 * 过期检测（1h 轮询）
 * 检查 deadline 已过但未完成的条目，主动询问用户
 */

import { getAllEntries } from "../data/file-engine";
import { daysBetween, todayStr } from "../utils/time-utils";
import { logger } from "../utils/logger";
import type { SendFn } from "./reminder";

export function checkExpiry(userId: string, sendFn: SendFn): void {
  const entries = getAllEntries(userId);
  const today = todayStr();

  for (const entry of entries) {
    if (!entry.deadline) continue;
    if (["x", "-"].includes(entry.statusChar)) continue;

    const deadlineDate = entry.deadline.slice(0, 10);
    const overdueDays = daysBetween(deadlineDate, today);
    if (overdueDays <= 0) continue;

    // 仅第一次过期时通知（一天之内）
    if (overdueDays <= 1) {
      sendFn(userId, `「${entry.title}」今天过期了，还需要做吗？`);
      logger.info(`过期提醒: ${entry.title}`, { userId, id: entry.id, overdueDays });
    } else if (overdueDays % 7 === 0) {
      // 每周再问一次
      sendFn(userId, `「${entry.title}」已经过期 ${overdueDays} 天了，还需要做吗？`);
    }
  }
}
