/**
 * OneBot v11 消息相关 API 类型定义。
 */

import type { OneBotApiResponse, OneBotFileInfo, OneBotMessageType } from "../common";
import type { OneBotMessage, OneBotMessageSegment } from "../message";
import type { OneBotPrivateSender, OneBotGroupSender } from "../event";

export interface OneBotSendPrivateMsgRequest {
  user_id: number;
  message: OneBotMessage;
  auto_escape?: boolean;
}

export interface OneBotSendGroupMsgRequest {
  group_id: number;
  message: OneBotMessage;
  auto_escape?: boolean;
}

export interface OneBotSendMsgRequest {
  message_type?: OneBotMessageType;
  user_id?: number;
  group_id?: number;
  message: OneBotMessage;
  auto_escape?: boolean;
}

export interface OneBotSendMsgData {
  message_id: number;
}

export type OneBotSendMsgResponse = OneBotApiResponse<OneBotSendMsgData>;

export interface OneBotDeleteMsgRequest {
  message_id: number;
}

export interface OneBotGetMsgRequest {
  message_id: number;
}

export interface OneBotGetMsgData {
  time: number;
  message_type: OneBotMessageType;
  message_id: number;
  real_id: number;
  sender: OneBotPrivateSender | OneBotGroupSender;
  message: OneBotMessageSegment[] | string;
  raw_message?: string;
}

export type OneBotGetMsgResponse = OneBotApiResponse<OneBotGetMsgData>;

export interface OneBotGetForwardMsgRequest {
  id: string;
}

export interface OneBotForwardMsgNode {
  sender: OneBotPrivateSender | OneBotGroupSender;
  time: number;
  content: OneBotMessage;
  message?: OneBotMessage;
  message_id?: number;
  user_id?: number;
  nickname?: string;
}

export interface OneBotGetForwardMsgData {
  messages: OneBotForwardMsgNode[];
}

export type OneBotGetForwardMsgResponse = OneBotApiResponse<OneBotGetForwardMsgData | OneBotForwardMsgNode[]>;

export interface OneBotSendLikeRequest {
  user_id: number;
  times?: number;
}

export type OneBotGetRecordRequest = {
  file: string;
  out_format: string;
};

export type OneBotGetRecordResponse = OneBotApiResponse<OneBotFileInfo>;

export type OneBotGetImageRequest = {
  file: string;
};

export type OneBotGetImageResponse = OneBotApiResponse<OneBotFileInfo>;

export type OneBotCanSendImageResponse = OneBotApiResponse<{ yes: boolean }>;
export type OneBotCanSendRecordResponse = OneBotApiResponse<{ yes: boolean }>;

