/**
 * 话题队列 CRUD
 * 存储路径：data/{userId}/topic-queue.json
 * Topic Agent 写入，主动消息读取，attention 注入
 */

import fs from "fs";
import path from "path";

const DATA_ROOT = path.resolve(process.cwd(), "data");

export interface TopicEntry {
  topic: string;
  source: string;
  createdAt: string;
  consumed: boolean;
}

function filePath(userId: string): string {
  return path.join(DATA_ROOT, userId, "topic-queue.json");
}

function load(userId: string): TopicEntry[] {
  const fp = filePath(userId);
  if (!fs.existsSync(fp)) return [];
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return [];
  }
}

function save(userId: string, data: TopicEntry[]): void {
  const fp = filePath(userId);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf-8");
}

/** 添加话题，自动去重（同 topic 字符串完全匹配则跳过） */
export function pushTopic(userId: string, topic: string, source: string): boolean {
  const data = load(userId);
  if (data.some((t) => t.topic === topic)) return false;
  data.push({
    topic,
    source,
    createdAt: new Date().toISOString().replace("T", " ").slice(0, 19),
    consumed: false,
  });
  save(userId, data);
  return true;
}

/** 拉取未消费的话题 */
export function pullUnconsumed(userId: string): TopicEntry[] {
  return load(userId).filter((t) => !t.consumed);
}

/** 标记为已消费 */
export function markConsumed(userId: string, topic: string): void {
  const data = load(userId);
  const entry = data.find((t) => t.topic === topic && !t.consumed);
  if (entry) {
    entry.consumed = true;
    save(userId, data);
  }
}

/** 清空已消费的旧话题（保留最近 N 天） */
export function cleanConsumed(userId: string, keepDays = 7): void {
  const cutoff = Date.now() - keepDays * 86_400_000;
  const data = load(userId).filter(
    (t) => !t.consumed || new Date(t.createdAt).getTime() > cutoff
  );
  save(userId, data);
}

/** 获取所有话题 */
export function getAllTopics(userId: string): TopicEntry[] {
  return load(userId);
}

/** 未消费话题摘要文本，供 attention 注入 */
export function topicQueueText(userId: string): string {
  const topics = pullUnconsumed(userId);
  if (topics.length === 0) return "";
  const lines = topics.map((t) => `- ${t.topic}（${t.source}）`);
  return `近期关注话题（${topics.length} 条）\n${lines.join("\n")}`;
}
