/**
 * TransactionEvent 持久化监听器
 * 监听运行期事件，筛选需要给前台 Agent 感知的后台事务回执。
 */

import fs from "fs";
import path from "path";
import { onTransactionEvent, TransactionEvent } from "./event";
import { config } from "../../config";

const DATA_ROOT = path.resolve(process.cwd(), "data");

const WRITE_TOOLS = new Set([
  "push_topic",
  "add_entry",
  "update_entry",
  "delete_entry",
  "create_folder",
  "update_folder",
  "delete_folder",
  "delete_file",
]);

const READ_EVIDENCE_TOOLS = new Set([
  "get_entry",
]);

const cache = new Map<string, TransactionEvent[]>();

function cacheKey(userId: string, mainSessionId: string): string {
  return `${userId}::${mainSessionId}`;
}

function filePath(userId: string, mainSessionId: string): string {
  return path.join(DATA_ROOT, userId, "session", mainSessionId, "transaction-events.json");
}

function legacyFilePath(userId: string, mainSessionId: string): string {
  return path.join(DATA_ROOT, userId, "session", mainSessionId, "transactions.json");
}

function load(userId: string, mainSessionId: string): TransactionEvent[] {
  const key = cacheKey(userId, mainSessionId);
  if (cache.has(key)) return cache.get(key)!;

  const fp = fs.existsSync(filePath(userId, mainSessionId))
    ? filePath(userId, mainSessionId)
    : legacyFilePath(userId, mainSessionId);
  if (!fs.existsSync(fp)) {
    cache.set(key, []);
    return [];
  }

  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    const events = Array.isArray(data) ? data : [];
    cache.set(key, events);
    return events;
  } catch {
    cache.set(key, []);
    return [];
  }
}

function save(userId: string, mainSessionId: string, events: TransactionEvent[]): void {
  const fp = filePath(userId, mainSessionId);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const trimmed = events.slice(-config.agent.transactionEventMaxKeep);
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(trimmed, null, 2), "utf-8");
  fs.renameSync(tmp, fp);
  cache.set(cacheKey(userId, mainSessionId), trimmed);
}

export function persistTransactionEvent(event: TransactionEvent): TransactionEvent {
  const events = load(event.userId, event.mainSessionId);
  const next: TransactionEvent = {
    ...event,
    id: event.id || `${Date.now()}_${events.length + 1}`,
    createdAt: event.createdAt || new Date().toISOString().replace("T", " ").slice(0, 19),
  };
  events.push(next);
  save(event.userId, event.mainSessionId, events);
  return next;
}

export function recentTransactionEvents(
  userId: string,
  mainSessionId: string,
  limit = config.agent.transactionEventAttentionLimit
): TransactionEvent[] {
  return load(userId, mainSessionId)
    .filter((event) => !isInternalDataTarget(event.args))
    .slice(-limit);
}

export function transactionEventAttentionText(userId: string, mainSessionId: string): string {
  const events = recentTransactionEvents(userId, mainSessionId);
  if (events.length === 0) return "";

  const lines = events.map((event) => {
    const tool = event.toolName ? `.${event.toolName}` : "";
    const target = targetOf(event);
    const targetText = target ? ` | 目标：${target}` : "";
    const summary = summaryOf(event);
    const summaryText = summary ? ` | 摘要：${summary}` : "";
    return `- ${event.createdAt} ${event.actor}.${event.type}${tool}${targetText}${summaryText}`;
  });

  return `最近后台事务事件（${events.length} 条）\n${lines.join("\n")}`;
}

function shouldPersist(event: TransactionEvent): boolean {
  if (typeof event.toolName !== "string") return false;
  if (isInternalDataTarget(event.args)) return false;

  if (event.actor === "main-agent") {
    return event.type === "tool.completed" && READ_EVIDENCE_TOOLS.has(event.toolName);
  }

  if (event.actor !== "topic-agent") return false;
  if (event.type !== "tool.completed" && event.type !== "tool.failed") return false;
  return WRITE_TOOLS.has(event.toolName);
}

function isInternalDataTarget(args: Record<string, unknown> | undefined): boolean {
  if (!args) return false;
  const rawParts = [
    args.folderPath,
    args.newFolder,
    args.fileName,
  ].filter((value): value is string => typeof value === "string");

  return rawParts.some((value) => {
    const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "").toLowerCase();
    return normalized === "session" ||
      normalized.startsWith("session/") ||
      normalized === "logs" ||
      normalized.startsWith("logs/");
  });
}

function targetOf(event: TransactionEvent): string {
  const args = event.args || {};
  if (typeof args.title === "string") return args.title;
  if (typeof args.topic === "string") return args.topic;
  const folder = typeof args.folderPath === "string" ? args.folderPath : "";
  const file = typeof args.fileName === "string" ? args.fileName : "";
  return [folder, file].filter(Boolean).join("/");
}

function summaryOf(event: TransactionEvent): string {
  if (event.error) return event.error;
  const result = event.result;
  if (!result || typeof result !== "object") return "";
  const data = result as { success?: unknown; added?: unknown; error?: unknown; folderPath?: unknown; fileName?: unknown; title?: unknown; persist?: unknown };
  if (data.error) return String(data.error);
  const pathText = [data.folderPath, data.fileName].filter((v) => typeof v === "string").join("/");
  if (pathText) return pathText;
  if (data.persist) return `persist=${String(data.persist)}`;
  if (data.title) return String(data.title);
  if (data.success !== undefined) return `success=${String(data.success)}`;
  if (data.added !== undefined) return `added=${String(data.added)}`;
  return "";
}

onTransactionEvent((event) => {
  if (shouldPersist(event)) persistTransactionEvent(event);
});
