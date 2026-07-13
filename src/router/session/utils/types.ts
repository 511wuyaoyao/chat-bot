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
  /** DeepSeek thinking 模式返回的推理内容，仅持久化用于调试，不回传给模型 */
  reasoning_content?: string;
  /** 模型返回的完整 usage，仅用于审计；get() 会过滤，不回传给模型 */
  usage?: Record<string, unknown>;
  /** 模型返回的 finish_reason，仅用于审计；get() 会过滤 */
  finish_reason?: string | null;
  /** 生成这条 assistant 消息的模型，仅用于审计；get() 会过滤 */
  model?: string;
  /** QQ message_id，用于撤回、引用和 topic 标注定位。持久化时按字符串保存，避免数字精度问题。 */
  message_id?: string;
  /** 后台 topic-agent 通过 push_topic 提炼出的消息话题，仅存储，不回传给模型。 */
  topic?: string;
  /** 上下文压缩逻辑删除标记，仅存储和调试使用，不回传给模型。 */
  deleted?: boolean;
  /** 上下文压缩逻辑删除原因，仅存储和调试使用。 */
  deletedReason?:
    | "main_tool_trace"
    | "main_no_topic"
    | "main_full_compaction"
    | "topic_user"
    | "topic_tool_trace"
    | "topic_no_persist";
  /** 上下文压缩逻辑删除时间，北京时间字符串。 */
  deletedAt?: string;
  /** 上下文压缩层级。 */
  compactionLayer?: 1 | 2 | 3;
  /** 上下文压缩提示，仅存储，不回传给模型。 */
  compactionHints?: {
    topicWritten?: boolean;
    dataMutated?: boolean;
  };
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
