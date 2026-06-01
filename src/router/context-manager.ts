/**
 * 对话上下文管理器
 *
 * 两层持久化：
 *   Layer 1 归档 — chat-archive.jsonl，append-only 完整记录，永不删除
 *   Layer 2 工作 — context.json，最近 N 条注入 AI 上下文窗口
 *
 * 注入策略：全量注入（上限 50 条），充分保留对话脉络
 */

import fs from "fs";
import path from "path";
import { logger } from "../utils/logger";

// ====== 类型 ======

export interface ContextEntry {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// ====== 配置 ======

/** 注入上限，防止 token 爆炸 */
const MAX_INJECT = 50;

// ====== 存储 ======

const DATA_ROOT = path.resolve(process.cwd(), "data");
const userContexts = new Map<string, ContextEntry[]>();

// ====== 路径 ======

function archivePath(userId: string): string {
  return path.join(DATA_ROOT, userId, "chat-archive.jsonl");
}

function contextPath(userId: string): string {
  return path.join(DATA_ROOT, userId, "context.json");
}

// ====== Layer 1: 归档（append-only） ======

function appendArchive(userId: string, entry: ContextEntry): void {
  try {
    const dir = path.dirname(archivePath(userId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(archivePath(userId), JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    logger.warn("归档写入失败", { userId, error: String(err) });
  }
}

// ====== Layer 2: 工作上下文（持久化 + 内存） ======

function saveWorking(userId: string, entries: ContextEntry[]): void {
  try {
    fs.writeFileSync(contextPath(userId), JSON.stringify(entries, null, 2), "utf-8");
  } catch (err) {
    logger.warn("上下文保存失败", { userId, error: String(err) });
  }
}

function loadWorking(userId: string): ContextEntry[] {
  try {
    if (fs.existsSync(contextPath(userId))) {
      const raw = fs.readFileSync(contextPath(userId), "utf-8");
      const entries = JSON.parse(raw);
      if (Array.isArray(entries)) return entries;
    }
  } catch (err) {
    logger.warn("上下文加载失败", { userId, error: String(err) });
  }
  return [];
}

// ====== 公开 API ======

/** 启动时加载 */
export function initUserContext(userId: string): void {
  const saved = loadWorking(userId);
  if (saved.length > 0) {
    userContexts.set(userId, saved);
    logger.debug(`上下文已加载`, { userId, entries: saved.length });
  }
}

/** 追加一条对话 */
export function pushContext(
  userId: string,
  role: "user" | "assistant",
  content: string
): void {
  if (!userContexts.has(userId)) {
    userContexts.set(userId, []);
  }

  const entry: ContextEntry = { role, content, timestamp: Date.now() };

  // Layer 1: 归档（完整保留）
  appendArchive(userId, entry);

  // Layer 2: 工作上下文（保留最近 MAX_INJECT 条）
  const ctx = userContexts.get(userId)!;
  ctx.push(entry);
  if (ctx.length > MAX_INJECT) {
    ctx.splice(0, ctx.length - MAX_INJECT);
  }
  userContexts.set(userId, ctx);
  saveWorking(userId, ctx);
}

/** 获取上下文（注入 AI），全量返回 */
export function getContext(
  userId: string
): { role: "user" | "assistant"; content: string }[] {
  if (!userContexts.has(userId)) {
    initUserContext(userId);
  }
  const entries = userContexts.get(userId) || [];
  return entries.map((e) => ({ role: e.role, content: e.content }));
}

/** 清除（重开对话） */
export function clearContext(userId: string): void {
  userContexts.delete(userId);
  try {
    if (fs.existsSync(contextPath(userId))) fs.unlinkSync(contextPath(userId));
  } catch (err) {
    logger.warn("清除上下文文件失败", { userId, error: String(err) });
  }
}
