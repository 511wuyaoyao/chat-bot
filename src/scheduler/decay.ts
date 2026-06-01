/**
 * 兴趣衰减（24h 轮询）
 * 超过 30 天无交互的条目每日 -1
 */

import { applyDecay } from "../recommend/interest-manager";
import { logger } from "../utils/logger";

export function runDecay(userId: string): void {
  const count = applyDecay(userId);
  if (count > 0) {
    logger.info(`兴趣衰减完成`, { userId, decayedCount: count });
  }
}
