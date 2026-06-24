/**
 * 会话类型定义
 * 纯数据层，不依赖任何业务模块
 */

/** 可存储的消息（兼容 OpenAI ChatCompletionMessageParam） */
export interface StoredMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
  /** DeepSeek thinking 模式返回的推理内容，必须原样传回 */
  reasoning_content?: string;
  /** QQ message_id，用于撤回定位（仅 user 消息有） */
  message_id?: number;
  /** 存储毫秒时间戳（存储层自动注入，调用方可不传） */
  timestamp?: number;
  /** 条目唯一 ID（存储层自动注入，调用方可不传） */
  id?: string;
}

/** 归档条目 */
export type ArchiveEntry =
  | { type: "user"; content: string; timestamp: number }
  | { type: "assistant"; content: string | null; tool_calls?: unknown; reasoning_content?: string; timestamp: number }
  | { type: "tool_call"; name: string; args: unknown; call_id: string; timestamp: number }
  | { type: "tool_result"; call_id: string; result: unknown; timestamp: number }
  | { type: "system_prompt"; content: string; timestamp: number };

