/**
 * 兴趣权重管理
 * 加减分调整 + 每日衰减
 */

import { updateEntry, getAllEntries } from "../data/file-engine";
import { daysBetween, todayStr } from "../utils/time-utils";
import { logger } from "../utils/logger";

/** 调整单条兴趣度 */
export function adjustInterest(userId: string, entryId: string, delta: number): boolean {
  const entries = getAllEntries(userId);
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return false;

  const newInterest = Math.max(0, Math.min(100, entry.interest + delta));
  updateEntry(userId, entryId, { interest: newInterest });

  logger.debug(`兴趣调整: ${entry.title}`, { userId, id: entryId, before: entry.interest, delta, after: newInterest });
  return true;
}

/** 每日衰减：超过 30 天无交互的条目 interest -1 */
export function applyDecay(userId: string): number {
  const entries = getAllEntries(userId);
  const today = todayStr();
  let decayed = 0;

  for (const entry of entries) {
    if (entry.interest <= 0) continue;
    const inactiveDays = daysBetween(entry.updatedAt, today);
    if (inactiveDays > 30) {
      const newInterest = Math.max(0, entry.interest - 1);
      updateEntry(userId, entry.id, { interest: newInterest });
      decayed++;
    }
  }

  if (decayed > 0) {
    logger.debug(`兴趣衰减`, { userId, decayedCount: decayed });
  }
  return decayed;
}
