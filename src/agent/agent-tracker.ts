/**
 * Agent 消息追踪 — 记录每条发出消息的归属 Agent，供引用回复路由
 */

export type AgentType = "main" | "topic" | "exec";

interface SentRecord {
  agent: AgentType;
  messageId: number;
  userId: string;
}

const records = new Map<number, SentRecord>();

/** 记录一条发出的消息 */
export function track(agent: AgentType, messageId: number, userId: string): void {
  records.set(messageId, { agent, messageId, userId });
}

/** 根据回复的 message_id 查找归属 Agent */
export function lookup(messageId: number): SentRecord | undefined {
  return records.get(messageId);
}
