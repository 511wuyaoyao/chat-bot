/**
 * QQ 官方机器人原始协议类型定义。
 */

export type QQBotEventType = "C2C_MESSAGE_CREATE" | "GROUP_AT_MESSAGE_CREATE" | string;

export interface QQBotAuthor {
  id?: string;
  username?: string;
  user_openid?: string;
  member_openid?: string;
}

export interface QQBotMessageEvent {
  id?: string;
  msg_id?: string;
  event_id?: string;
  message_type?: number | string;
  timestamp?: string;
  content?: string;
  msg_elements?: QQBotMsgElement[];
  message_scene?: QQBotMessageScene;
  group_openid?: string;
  channel_id?: string;
  message_reference?: QQBotMessageReference;
  reference?: QQBotMessageReference;
  referenced_message?: QQBotMessageReference;
  reply?: QQBotMessageReference;
  src_msg_id?: string;
  author?: QQBotAuthor;
  member?: {
    user_openid?: string;
    member_openid?: string;
    nick?: string;
  };
}

export interface QQBotMessageScene {
  source?: string;
  ext?: Array<string | Record<string, unknown>>;
  [key: string]: unknown;
}

export interface QQBotMsgElement {
  type?: string | number;
  element_type?: string | number;
  text?: string | { content?: string; text?: string; [key: string]: unknown };
  content?: string;
  data?: unknown;
  elements?: QQBotMsgElement[];
  msg_elements?: QQBotMsgElement[];
  [key: string]: unknown;
}

export interface QQBotMessageReference {
  id?: string;
  msg_id?: string;
  message_id?: string;
  event_id?: string;
  src_msg_id?: string;
  [key: string]: unknown;
}

export interface QQBotWebhookPayload {
  id?: string;
  op?: number;
  s?: number;
  t?: QQBotEventType;
  d?: QQBotMessageEvent;
}

export type QQBotGatewayTransport = "websocket" | "webhook";

export interface QQBotGatewayPayload {
  op: number;
  s?: number | null;
  t?: QQBotEventType;
  d?: unknown;
}

export interface QQBotGatewayBotResponse {
  url?: string;
  shards?: number;
  session_start_limit?: {
    total?: number;
    remaining?: number;
    reset_after?: number;
    max_concurrency?: number;
  };
}

export interface QQBotAccessTokenResponse {
  access_token?: string;
  expires_in?: number | string;
  accessToken?: string;
  expiresIn?: number | string;
  code?: number | string;
  err_code?: number | string;
  message?: string;
  trace_id?: string;
}

export interface QQBotSendMessageResponse {
  id?: string;
  msg_id?: string;
  message_id?: string;
  [key: string]: unknown;
}

export interface QQBotClientOptions {
  appId: string;
  appSecret: string;
  apiBaseUrl?: string;
  apiTimeoutMs?: number;
  logger: {
    debug(message: string, meta?: Record<string, unknown>): void;
    info(message: string, meta?: Record<string, unknown>): void;
    warn(message: string, meta?: Record<string, unknown>): void;
    error(message: string, meta?: Record<string, unknown>): void;
  };
}
