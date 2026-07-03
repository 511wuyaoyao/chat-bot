/**
 * QQ 适配层接口类型
 * 定义适配器向下层传递的统一消息、引用和撤回事件结构。
 */

export type QqMessageType = "private" | "group";
export type QqMessageCategory =
  | "private_self_chat"
  | "private_user_chat"
  | "group_mention_agent"
  | "group_all_chat"
  | "group_self_mention_self"
  | "ignored";

export interface QqReply {
  message_id: number;
  user_id: number;
  raw_message: string;
  raw_segments?: unknown;
  parsed_message?: string;
}

/** OneBot v11 消息事件规范化后的下层消息 */
export interface QqMessage {
  message_id: number;
  user_id: number;
  group_id?: number;
  message_type: QqMessageType;
  raw_message: string;
  /** QQ 原始 raw_message；群聊 @ 清洗前用于适配层判断是否 @ 自己 */
  original_raw_message?: string;
  /** QQ 适配层消息分类 */
  category?: QqMessageCategory;
  sender: {
    nickname: string;
    card?: string;
  };
  /** 引用回复的消息，用户引用某条消息时存在 */
  reply?: QqReply | null;
  /** 是否为当前账号自己发出的 message_sent 事件 */
  is_self_sent?: boolean;
  /** 私聊 message_sent 的对端账号；仅适配层能可靠识别时写入 */
  private_peer_id?: number;
}

export interface QqRecallEvent {
  userId: string;
  messageId: number;
}

export interface QqAdapterOptions {
  onMessage: (msg: QqMessage) => Promise<void>;
  /** 用户撤回消息时回调，传入 user_id 和被撤回的 message_id */
  onRecall?: (userId: string, messageId: number) => void;
  /** 消息段渲染产生额外模型 usage 时回调，由上层决定如何汇总。 */
  onTokenUsage?: (userId: string, actor: string, usage: unknown) => void;
}

export interface OneBotApiResponse {
  status?: string;
  retcode?: number;
  message?: string;
  wording?: string;
  data?: {
    message_id?: number;
  } | null;
}
