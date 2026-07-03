/**
 * TransactionEvent 事件总线
 * Agent 运行期事件与后台事务回执共用同一个事件模型。
 */

export type TransactionEventType =
  | "agent.started"
  | "agent.completed"
  | "agent.failed"
  | "tool.started"
  | "tool.completed"
  | "tool.failed";

export interface TransactionEvent {
  id?: string;
  type: TransactionEventType;
  createdAt?: string;
  userId: string;
  sessionId: string;
  mainSessionId: string;
  actor: "topic-agent" | "exec-agent" | "main-agent" | string;
  toolName?: string;
  args?: Record<string, unknown>;
  result?: unknown;
  error?: string;
  reply?: string;
}

export type TransactionEventHandler = (event: TransactionEvent) => void;

const handlers = new Set<TransactionEventHandler>();

export function emitTransactionEvent(event: TransactionEvent): void {
  for (const handler of handlers) {
    handler(event);
  }
}

export function onTransactionEvent(handler: TransactionEventHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}
