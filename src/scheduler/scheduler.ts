/**
 * 调度器主循环
 * 管理所有定时任务的启动和停止
 */

import { checkReminders, SendFn } from "./reminder";
import { checkRecurring } from "./recurring";
import { checkExpiry } from "./expiry";
import { runDecay } from "./decay";
import { checkDailySummary } from "./daily-summary";
import { logger } from "../utils/logger";

const userTimers = new Map<string, NodeJS.Timeout[]>();

/** 为指定用户启动所有定时器 */
export function start(userId: string, sendFn: SendFn): void {
  if (userTimers.has(userId)) {
    stop(userId);
  }

  const timers: NodeJS.Timeout[] = [];

  // 提醒检查：15s
  timers.push(setInterval(() => {
    try { checkReminders(userId, sendFn); } catch (e) { logger.error("提醒检查异常", { error: String(e) }); }
  }, 15_000));

  // 重复任务：5min
  timers.push(setInterval(() => {
    try { checkRecurring(userId); } catch (e) { logger.error("重复任务异常", { error: String(e) }); }
  }, 300_000));

  // 过期检测：1h
  timers.push(setInterval(() => {
    try { checkExpiry(userId, sendFn); } catch (e) { logger.error("过期检测异常", { error: String(e) }); }
  }, 3_600_000));

  // 兴趣衰减：24h
  timers.push(setInterval(() => {
    try { runDecay(userId); } catch (e) { logger.error("兴趣衰减异常", { error: String(e) }); }
  }, 86_400_000));

  // 每日汇总：每分钟检查一次是否到 09:00
  timers.push(setInterval(() => {
    try { checkDailySummary(userId, sendFn); } catch (e) { logger.error("每日汇总异常", { error: String(e) }); }
  }, 60_000));

  userTimers.set(userId, timers);
  logger.info(`调度器已启动`, { userId });
}

/** 停止指定用户的定时器 */
export function stop(userId: string): void {
  const timers = userTimers.get(userId);
  if (timers) {
    timers.forEach(clearInterval);
    userTimers.delete(userId);
    logger.info(`调度器已停止`, { userId });
  }
}

/** 停止所有定时器 */
export function stopAll(): void {
  for (const userId of userTimers.keys()) {
    stop(userId);
  }
}
