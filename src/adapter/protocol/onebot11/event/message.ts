/**
 * OneBot v11 消息事件类型定义。
 */

import type { OneBotCommonEventFields, OneBotId, OneBotMessageType } from "../common";
import type { OneBotMessage, OneBotMessageSegment } from "../message";

export type OneBotMessageEvent = OneBotPrivateMessageEvent | OneBotGroupMessageEvent;

export interface OneBotBaseMessageEvent extends OneBotCommonEventFields {
  post_type: "message";
  message_type: OneBotMessageType;
  sub_type: string;
  message_id: number;
  user_id: OneBotId;
  message: OneBotMessage;
  raw_message: string;
  font: number;
}

export interface OneBotPrivateMessageEvent extends OneBotBaseMessageEvent {
  message_type: "private";
  sub_type: "friend" | "group" | "other" | string;
  sender: OneBotPrivateSender;
}

export interface OneBotGroupMessageEvent extends OneBotBaseMessageEvent {
  message_type: "group";
  sub_type: "normal" | "anonymous" | "notice" | string;
  group_id: OneBotId;
  anonymous?: OneBotAnonymousInfo | null;
  sender: OneBotGroupSender;
}

export interface OneBotPrivateSender {
  user_id: OneBotId;
  nickname: string;
  sex: "male" | "female" | "unknown" | string;
  age: number;
}

export interface OneBotGroupSender extends OneBotPrivateSender {
  card: string;
  area: string;
  level: string;
  role: "owner" | "admin" | "member" | string;
  title: string;
}

export interface OneBotAnonymousInfo {
  id: number;
  name: string;
  flag: string;
}

export interface OneBotMessageEventWithRawSegments extends OneBotBaseMessageEvent {
  message: OneBotMessageSegment[];
}
