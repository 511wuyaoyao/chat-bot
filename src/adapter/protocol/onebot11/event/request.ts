/**
 * OneBot v11 请求事件类型定义。
 */

import type { OneBotCommonEventFields } from "../common";

export type OneBotRequestEvent = OneBotFriendRequestEvent | OneBotGroupRequestEvent;

export interface OneBotBaseRequestEvent extends OneBotCommonEventFields {
  post_type: "request";
  request_type: string;
  user_id: number;
  comment: string;
  flag: string;
}

export interface OneBotFriendRequestEvent extends OneBotBaseRequestEvent {
  request_type: "friend";
}

export interface OneBotGroupRequestEvent extends OneBotBaseRequestEvent {
  request_type: "group";
  sub_type: "add" | "invite" | string;
  group_id: number;
}

