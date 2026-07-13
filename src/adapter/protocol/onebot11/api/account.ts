/**
 * OneBot v11 账号与好友相关 API 类型定义。
 */

import type { OneBotApiResponse } from "../common";

export interface OneBotLoginInfo {
  user_id: number;
  nickname: string;
}

export type OneBotGetLoginInfoResponse = OneBotApiResponse<OneBotLoginInfo>;

export interface OneBotGetStrangerInfoRequest {
  user_id: number;
  no_cache?: boolean;
}

export interface OneBotStrangerInfo {
  user_id: number;
  nickname: string;
  sex: "male" | "female" | "unknown" | string;
  age: number;
}

export type OneBotGetStrangerInfoResponse = OneBotApiResponse<OneBotStrangerInfo>;

export interface OneBotFriendInfo {
  user_id: number;
  nickname: string;
  remark: string;
}

export type OneBotGetFriendListResponse = OneBotApiResponse<OneBotFriendInfo[]>;

export interface OneBotFriendAddRequestHandleRequest {
  flag: string;
  approve?: boolean;
  remark?: string;
}

