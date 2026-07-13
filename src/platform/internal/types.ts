/**
 * 平台内部统一消息协议类型。
 */

export type InternalMessageType = "private" | "group";

export type InternalMessageCategory =
  | "private_self_chat"
  | "private_user_chat"
  | "group_mention_agent"
  | "group_all_chat"
  | "group_self_mention_self"
  | "ignored";

export interface InternalReply {
  message_id: number;
  user_id: number;
  raw_message: string;
  raw_segments?: unknown;
  parsed_message?: string;
}

export interface InternalMessage {
  message_id: number;
  user_id: number;
  group_id?: number;
  message_type: InternalMessageType;
  raw_message: string;
  original_raw_message?: string;
  category?: InternalMessageCategory;
  sender: {
    nickname: string;
    card?: string;
  };
  reply?: InternalReply | null;
  is_self_sent?: boolean;
  private_peer_id?: number;
  self_id?: number;
}

export interface InternalRecallEvent {
  userId: string;
  messageId: number;
}

export interface PlatformOptions {
  onMessage: (msg: InternalMessage) => Promise<void>;
  onRecall?: (userId: string, messageId: number) => void;
  onTokenUsage?: (userId: string, actor: string, usage: unknown) => void;
}
