/**
 * 话题队列 — 内存缓存 + 原子持久化
 * 存储路径：data/{userId}/session/{mainSessionId}/topic-queue.json
 */

import fs from "fs";
import path from "path";

const DATA_ROOT = path.resolve(process.cwd(), "data");

export type PersistDecision = "yes" | "ask" | "no";

export interface TopicEntry {
  topic: string;
  source: string;
  summary: string;
  createdAt: string;
  persist: PersistDecision;
  askMessageId?: number;
}

// ====== 内存缓存 ======

const cache = new Map<string, TopicEntry[]>();

function filePath(userId: string, sessionId: string): string {
  return path.join(DATA_ROOT, userId, "session", sessionId, "topic-queue.json");
}

function load(userId: string, sessionId: string): TopicEntry[] {
  const key = sessionId;
  if (cache.has(key)) return cache.get(key)!;
  const fp = filePath(userId, sessionId);
  if (!fs.existsSync(fp)) {
    cache.set(key, []);
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf-8"));
    cache.set(key, data);
    return data;
  } catch {
    cache.set(key, []);
    return [];
  }
}

function save(userId: string, sessionId: string, data: TopicEntry[]): void {
  const fp = filePath(userId, sessionId);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = fp + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, fp);
  cache.set(sessionId, data);
}

// ====== 对外接口 ======

export function pushTopic(
  userId: string, sessionId: string,
  topic: string, source: string, summary: string,
  persist: PersistDecision, askMessageId?: number
): boolean {
  const data = load(userId, sessionId);
  if (data.some((t) => t.topic === topic)) return false;
  data.push({ topic, source, summary, createdAt: new Date().toISOString().replace("T", " ").slice(0, 19), persist, askMessageId });
  if (data.length > 50) data.splice(0, data.length - 50);
  save(userId, sessionId, data);
  return true;
}

export function pullActive(userId: string, sessionId: string): TopicEntry[] {
  return load(userId, sessionId).filter((t) => t.persist === "yes");
}

export function findByAskMessageId(userId: string, sessionId: string, messageId: number): TopicEntry | undefined {
  return load(userId, sessionId).find((t) => t.askMessageId === messageId);
}

export function flush(userId: string, sessionId: string): void {
  save(userId, sessionId, load(userId, sessionId));
}

export function getAllTopics(userId: string, sessionId: string): TopicEntry[] {
  return load(userId, sessionId);
}

export function topicQueueText(userId: string, sessionId: string): string {
  const topics = pullActive(userId, sessionId);
  if (topics.length === 0) return "";
  const lines = topics.map((t) => `- ${t.topic}（${t.source}）`);
  return `近期关注话题（${topics.length} 条）\n${lines.join("\n")}`;
}
