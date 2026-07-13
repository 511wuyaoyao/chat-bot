/**
 * OneBot v11 群相关 API 类型定义。
 */

import type { OneBotApiResponse } from "../common";

export interface OneBotSetGroupKickRequest {
  group_id: number;
  user_id: number;
  reject_add_request?: boolean;
}

export interface OneBotSetGroupBanRequest {
  group_id: number;
  user_id: number;
  duration?: number;
}

export interface OneBotSetGroupAnonymousBanRequest {
  group_id: number;
  anonymous?: unknown;
  anonymous_flag?: string;
  duration?: number;
}

export interface OneBotSetGroupWholeBanRequest {
  group_id: number;
  enable?: boolean;
}

export interface OneBotSetGroupAdminRequest {
  group_id: number;
  user_id: number;
  enable?: boolean;
}

export interface OneBotSetGroupAnonymousRequest {
  group_id: number;
  enable?: boolean;
}

export interface OneBotSetGroupCardRequest {
  group_id: number;
  user_id: number;
  card?: string;
}

export interface OneBotSetGroupNameRequest {
  group_id: number;
  group_name: string;
}

export interface OneBotSetGroupLeaveRequest {
  group_id: number;
  is_dismiss?: boolean;
}

export interface OneBotSetGroupSpecialTitleRequest {
  group_id: number;
  user_id: number;
  special_title?: string;
  duration?: number;
}

export interface OneBotGroupAddRequestHandleRequest {
  flag: string;
  sub_type: "add" | "invite" | string;
  approve?: boolean;
  reason?: string;
}

export interface OneBotGroupInfoRequest {
  group_id: number;
  no_cache?: boolean;
}

export interface OneBotGroupInfo {
  group_id: number;
  group_name: string;
  member_count: number;
  max_member_count: number;
}

export type OneBotGetGroupInfoResponse = OneBotApiResponse<OneBotGroupInfo>;
export type OneBotGetGroupListResponse = OneBotApiResponse<OneBotGroupInfo[]>;

export interface OneBotGetGroupMemberInfoRequest {
  group_id: number;
  user_id: number;
  no_cache?: boolean;
}

export interface OneBotGroupMemberInfo {
  group_id: number;
  user_id: number;
  nickname: string;
  card: string;
  sex: "male" | "female" | "unknown" | string;
  age: number;
  area: string;
  join_time: number;
  last_sent_time: number;
  level: string;
  role: "owner" | "admin" | "member" | string;
  unfriendly: boolean;
  title: string;
  title_expire_time: number;
  card_changeable: boolean;
}

export type OneBotGetGroupMemberInfoResponse = OneBotApiResponse<OneBotGroupMemberInfo>;

export interface OneBotGetGroupMemberListRequest {
  group_id: number;
}

export type OneBotGetGroupMemberListResponse = OneBotApiResponse<OneBotGroupMemberInfo[]>;

export interface OneBotGetGroupHonorInfoRequest {
  group_id: number;
  type: "talkative" | "performer" | "legend" | "strong_newbie" | "emotion" | "all" | string;
}

export interface OneBotGroupHonorInfo {
  group_id: number;
  current_talkative?: OneBotHonorUser;
  talkative_list?: OneBotHonorUser[];
  performer_list?: OneBotHonorUser[];
  legend_list?: OneBotHonorUser[];
  strong_newbie_list?: OneBotHonorUser[];
  emotion_list?: OneBotHonorUser[];
}

export interface OneBotHonorUser {
  user_id: number;
  nickname: string;
  avatar: string;
  description?: string;
  day_count?: number;
}

export type OneBotGetGroupHonorInfoResponse = OneBotApiResponse<OneBotGroupHonorInfo>;

