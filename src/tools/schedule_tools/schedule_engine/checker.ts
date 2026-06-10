/**
 * 轮询器 — 检测到期任务 + 刷新重复规则
 * 执行顺序：先标记已触发 → 再执行回调 → 最后排期下次
 * 防止回调抛错导致任务卡在"到期"状态无限重试
 */

import { getDueRecurring, getDueOnce, getStaleRepeats, markFired, reschedule, calcNextRepeat, listSchedules } from "./schedule-engine";
import { ScheduleEntry } from "./types";
import { logger } from "../../../utils/logger";

const timers = new Map<string, NodeJS.Timeout[]>();

export type DueCallback = (userId: string, entry: ScheduleEntry) => Promise<void>;

export function start(userId: string, onDue: DueCallback): void {
  if (timers.has(userId)) stop(userId);
  const list: NodeJS.Timeout[] = [];

  // 启动时输出当前定时任务状态
  const all = listSchedules(userId);
  logger.info("轮询器启动", {
    userId,
    total: all.length,
    enabled: all.filter(e => e.enabled).length,
    tasks: all.map(e => `${e.id}(${e.entryTitle}) type=${e.type} triggerAt=${e.triggerAt} enabled=${e.enabled}`),
  });

  // 启动时立即检查并执行到期任务（处理重启期间错过的任务）
  (async () => {
    try {
      const [recurring, once] = [getDueRecurring(userId), getDueOnce(userId)];
      const dueNow = [...recurring, ...once];
      if (dueNow.length > 0) {
        logger.info("启动时发现到期任务，开始执行", {
          userId,
          count: dueNow.length,
          tasks: dueNow.map(e => `${e.entryTitle} @ ${e.triggerAt}`),
        });
        for (const e of recurring) {
          await handleRecurring(userId, e, onDue);
        }
        for (const e of once) {
          await handleOnce(userId, e, onDue);
        }
        logger.info("启动时到期任务执行完毕", { userId, count: dueNow.length });
      }
    } catch (err) {
      logger.error("启动检查异常", { error: String(err), userId });
    }
  })();

  // 定时任务检查: 15s
  list.push(setInterval(() => {
    (async () => {
      try {
        const due = getDueRecurring(userId);
        if (due.length > 0) {
          logger.debug("定时任务到期", {
            userId,
            count: due.length,
            tasks: due.map(e => `${e.entryTitle} triggerAt=${e.triggerAt}`),
          });
        }
        for (const e of due) {
          await handleRecurring(userId, e, onDue);
        }
      } catch (err) {
        logger.error("定时任务检查异常", { error: String(err), userId });
      }
    })();
  }, 15_000));

  // 一次任务检查: 60s
  list.push(setInterval(() => {
    (async () => {
      try {
        const due = getDueOnce(userId);
        if (due.length > 0) {
          logger.debug("一次任务到期", {
            userId,
            count: due.length,
            tasks: due.map(e => `${e.entryTitle} triggerAt=${e.triggerAt}`),
          });
        }
        for (const e of due) {
          await handleOnce(userId, e, onDue);
        }
      } catch (err) {
        logger.error("一次任务检查异常", { error: String(err), userId });
      }
    })();
  }, 60_000));

  // 兜底刷新: 5min（救援 onDue 失败导致卡住的任务，重试回调 + 排期）
  list.push(setInterval(() => {
    (async () => {
      try {
        const stale = getStaleRepeats(userId);
        if (stale.length > 0) {
          logger.info("兜底刷新发现卡住的任务，尝试重试", {
            userId,
            count: stale.length,
            tasks: stale.map(e => `${e.entryTitle} lastFiredAt=${e.lastFiredAt} triggerAt=${e.triggerAt}`),
          });
        }
        for (const e of stale) {
          await handleRecurring(userId, e, onDue);
        }
      } catch (err) {
        logger.error("兜底刷新异常", { error: String(err), userId });
      }
    })();
  }, 300_000));

  timers.set(userId, list);
  logger.info("轮询器已启动", { userId });
}

export function stop(userId: string): void {
  const list = timers.get(userId);
  if (list) { list.forEach(clearInterval); timers.delete(userId); }
  logger.info("轮询器已停止", { userId });
}

export function stopAll(): void {
  for (const uid of timers.keys()) stop(uid);
}

// ====== 处理逻辑 ======

async function handleRecurring(userId: string, e: ScheduleEntry, onDue: DueCallback): Promise<void> {
  if (!e.repeatRule) return;

  const next = calcNextRepeat(e.repeatRule, e.triggerAt);
  if (!next) {
    logger.warn("重复规则解析失败，无法排期下次", { userId, task: e.entryTitle, rule: e.repeatRule });
    return;
  }

  // 1. 先标记"已触发"，防止 15s 间隔重复触发同一个任务
  markFired(userId, e.id);
  logger.info("定时任务触发", { userId, task: e.entryTitle, triggerAt: e.triggerAt, next });

  // 2. 执行回调（agentLoop + 发消息）
  try {
    await onDue(userId, e);
    logger.info("定时任务回调完成", { userId, task: e.entryTitle });
    // 成功 → 排期下次
    reschedule(userId, e.id, next);
    logger.info("定时任务已重新排期", { userId, task: e.entryTitle, next });
  } catch (err) {
    // 失败 → 不立即排期，保留 lastFiredAt，由兜底刷新（5min后）救援重试
    logger.error("定时任务回调失败（保留触发状态，等待兜底刷新重试）", {
      userId,
      task: e.entryTitle,
      error: String(err),
    });
  }
}

async function handleOnce(userId: string, e: ScheduleEntry, onDue: DueCallback): Promise<void> {
  // 1. 先标记"已触发"
  markFired(userId, e.id);
  logger.info("一次任务触发", { userId, task: e.entryTitle, triggerAt: e.triggerAt });

  // 2. 执行回调
  try {
    await onDue(userId, e);
    logger.info("一次任务回调完成", { userId, task: e.entryTitle });
  } catch (err) {
    logger.error("一次任务回调失败", { userId, task: e.entryTitle, error: String(err) });
  }
}
