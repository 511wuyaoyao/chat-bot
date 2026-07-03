/**
 * 璇濋闃熷垪 鈥?鍐呭瓨缂撳瓨 + 鍘熷瓙鎸佷箙鍖? * 瀛樺偍璺緞锛歞ata/{userId}/session/{mainSessionId}/topic-queue.json
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

// ====== 鍐呭瓨缂撳瓨 ======

const cache = new Map<string, TopicEntry[]>();

function cacheKey(userId: string, sessionId: string): string {
  return `${userId}:${sessionId}`;
}

function filePath(userId: string, sessionId: string): string {
  return path.join(DATA_ROOT, userId, "session", sessionId, "topic-queue.json");
}

function load(userId: string, sessionId: string): TopicEntry[] {
  const key = cacheKey(userId, sessionId);
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
  cache.set(cacheKey(userId, sessionId), data);
}

// ====== 瀵瑰鎺ュ彛 ======

export function pushTopic(
  userId: string, sessionId: string,
  topic: string, source: string, summary: string,
  persist: PersistDecision, askMessageId?: number
): boolean {
  const data = load(userId, sessionId);
  const existing = data.find((t) => t.topic === topic);
  if (existing) {
    existing.source = source;
    existing.summary = summary;
    existing.persist = persist;
    if (askMessageId !== undefined) existing.askMessageId = askMessageId;
    save(userId, sessionId, data);
    return false;
  }
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
  const allTopics = getAllTopics(userId, sessionId);
  const activeTopics = allTopics.filter((t) => t.persist === "yes" || t.persist === "ask");
  if (allTopics.length === 0) return "当前追踪话题：暂无";

  const activeLines = activeTopics.map((t) =>
    `- ${t.topic} [${t.persist}] ${t.createdAt} | 来源：${t.source} | 摘要：${t.summary}`
  );
  if (activeLines.length > 0) {
    return `当前追踪话题（${activeLines.length} 条）\n${activeLines.join("\n")}`;
  }

  const inactiveLines = allTopics
    .filter((t) => t.persist === "no")
    .slice(-3)
    .map((t) => `- ${t.topic} [no] ${t.createdAt} | ${t.summary}`);

  return [
    "当前追踪话题：暂无活跃",
    inactiveLines.length > 0
      ? `非活跃话题（仅用于避免重复，不要主动延续）：\n${inactiveLines.join("\n")}`
      : "",
  ].filter(Boolean).join("\n");
}
