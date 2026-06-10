/**
 * 定时任务引擎
 * 原子操作：内存 Map + JSON 持久化
 * 存储路径：data/{userId}/schedules.json
 */

import fs from "fs";
import path from "path";
import { ScheduleEntry } from "./types";
import { logger } from "../../../utils/logger";

const ROOT = path.resolve(process.cwd(), "data");

// ====== 内存 ======

const store = new Map<string, ScheduleEntry[]>(); // userId → entries

// ====== 读写 ======

function filePath(userId: string): string {
  return path.join(ROOT, userId, "schedules.json");
}

function load(userId: string): ScheduleEntry[] {
  if (store.has(userId)) return store.get(userId)!;
  try {
    const fp = filePath(userId);
    if (!fs.existsSync(fp)) {
      store.set(userId, []);
      return [];
    }
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    const entries = Array.isArray(data) ? data : [];
    store.set(userId, entries);
    return entries;
  } catch (err) {
    logger.warn("加载定时任务失败", { userId, error: String(err) });
    store.set(userId, []);
    return [];
  }
}

function save(userId: string): void {
  const entries = store.get(userId);
  if (!entries) return;
  try {
    const fp = filePath(userId);
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(entries, null, 2), "utf-8");
  } catch (err) {
    logger.error("保存定时任务失败", { userId, error: String(err) });
  }
}

// ====== 原子操作 ======

export function addSchedule(userId: string, entry: ScheduleEntry): boolean {
  const entries = load(userId);
  if (entries.find((e) => e.id === entry.id)) return false;
  entries.push(entry);
  save(userId);
  return true;
}

export function removeSchedule(userId: string, id: string): boolean {
  const entries = load(userId);
  const idx = entries.findIndex((e) => e.id === id);
  if (idx < 0) return false;
  entries.splice(idx, 1);
  save(userId);
  return true;
}

export function updateSchedule(userId: string, id: string, changes: Partial<ScheduleEntry>): boolean {
  const entries = load(userId);
  const entry = entries.find((e) => e.id === id);
  if (!entry) return false;
  Object.assign(entry, changes);
  save(userId);
  return true;
}

export function getSchedule(userId: string, id: string): ScheduleEntry | undefined {
  return load(userId).find((e) => e.id === id);
}

export function listSchedules(userId: string): ScheduleEntry[] {
  return [...load(userId)];
}

// ====== 查询 ======

function nowLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 防重窗口时间：N 分钟前 */
function guardTime(minutes = 2): string {
  const d = new Date(Date.now() - minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 获取到期的定时任务（可重复），含防重守卫：最近 2 分钟内触发过的跳过 */
export function getDueRecurring(userId: string): ScheduleEntry[] {
  const now = nowLocal();
  const guard = guardTime(); // 防重窗口：2 分钟前
  return load(userId).filter((e) => {
    if (e.type !== "recurring") return false;
    if (!e.enabled) return false;
    if (!e.repeatRule) return false;
    if (e.triggerAt.slice(0, 16) > now) return false;
    if (e.mutedUntil && e.mutedUntil.slice(0, 16) > now) return false;
    // 防重：最近 2 分钟内已触发过的跳过，避免 onDue 执行中重复触发
    if (e.lastFiredAt && e.lastFiredAt.slice(0, 16) >= guard) return false;
    return true;
  });
}

/** 获取到期的一次任务 */
export function getDueOnce(userId: string): ScheduleEntry[] {
  const now = nowLocal();
  return load(userId).filter((e) =>
    e.type === "once" &&
    e.enabled &&
    e.triggerAt.slice(0, 16) <= now &&
    !e.lastFiredAt &&
    (!e.mutedUntil || e.mutedUntil.slice(0, 16) <= now)
  );
}

/** 获取已触发但未重新排期的重复任务（兜底刷新用），排除 5 分钟内刚触发的 */
export function getStaleRepeats(userId: string): ScheduleEntry[] {
  const now = nowLocal();
  const staleGuard = guardTime(5); // 5 分钟内的不救，留给正常流程
  return load(userId).filter((e) =>
    e.repeatRule &&
    e.lastFiredAt &&
    e.triggerAt.slice(0, 16) <= now &&
    e.lastFiredAt.slice(0, 16) < staleGuard  // 卡了超过 5 分钟才兜底
  );
}

// ====== 状态变更 ======

export function markFired(userId: string, id: string): boolean {
  return updateSchedule(userId, id, { lastFiredAt: nowLocal() });
}

export function reschedule(userId: string, id: string, nextTriggerAt: string): boolean {
  return updateSchedule(userId, id, { triggerAt: nextTriggerAt, lastFiredAt: undefined });
}

export function setEnabled(userId: string, id: string, enabled: boolean): boolean {
  return updateSchedule(userId, id, { enabled });
}

export function setMuted(userId: string, id: string, mutedUntil: string): boolean {
  return updateSchedule(userId, id, { mutedUntil });
}

// ====== 重复计算 ======

/** 根据 repeatRule 计算下次触发时间 */
export function calcNextRepeat(rule: string, currentAt: string): string | null {
  const current = new Date(currentAt);
  if (isNaN(current.getTime())) return null;

  const daily = rule.match(/^daily:(\d{1,2}):(\d{2})$/);
  if (daily) {
    const next = new Date(current);
    next.setDate(next.getDate() + 1);
    next.setHours(parseInt(daily[1]), parseInt(daily[2]), 0, 0);
    return formatTime(next);
  }

  const weekly = rule.match(/^weekly:([0-6]):(\d{1,2}):(\d{2})$/);
  if (weekly) {
    const targetDay = parseInt(weekly[1]);
    const next = new Date(current);
    next.setDate(next.getDate() + 1);
    while (next.getDay() !== targetDay) next.setDate(next.getDate() + 1);
    next.setHours(parseInt(weekly[2]), parseInt(weekly[3]), 0, 0);
    return formatTime(next);
  }

  return null;
}

function formatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
