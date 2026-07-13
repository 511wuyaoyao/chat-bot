/**
 * OneBot v11 通用基础类型。
 */

export type OneBotPostType = "message" | "message_sent" | "notice" | "request" | "meta_event";
export type OneBotMessageType = "private" | "group";
export type OneBotMessageFormat = "string" | "array";
export type OneBotApiStatus = "ok" | "failed";

export interface OneBotApiResponse<TData = unknown> {
  status?: OneBotApiStatus | string;
  retcode?: number;
  data?: TData | null;
  message?: string;
  wording?: string;
  echo?: unknown;
}

export interface OneBotEmptyData {
  [key: string]: never;
}

export interface OneBotFileInfo {
  file: string;
  url?: string;
  file_size?: number;
  file_name?: string;
  base64?: string;
}

export interface OneBotCommonEventFields {
  time: number;
  self_id: number;
  post_type: OneBotPostType;
}

