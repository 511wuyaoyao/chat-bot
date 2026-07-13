/**
 * 合并转发消息类型
 * 定义 NapCat get_forward_msg 返回的合并转发消息结构。
 */

export interface ForwardedMessage {
  sender?: {
    nickname?: unknown;
    user_id?: unknown;
  };
  user_id?: unknown;
  raw_message?: unknown;
  message?: unknown;
  content?: unknown;
}

export interface ForwardMessageApiResponse {
  status?: string;
  retcode?: number;
  message?: string;
  wording?: string;
  data?: {
    messages?: ForwardedMessage[];
    content?: ForwardedMessage[];
  } | ForwardedMessage[] | null;
}
