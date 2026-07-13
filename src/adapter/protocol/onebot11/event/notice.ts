/**
 * OneBot v11 通知事件类型定义。
 */

import type { OneBotCommonEventFields } from "../common";
import type { OneBotFileInfo } from "../common";
import type { OneBotAnonymousInfo } from "./message";

export type OneBotNoticeEvent =
  | OneBotGroupUploadNoticeEvent
  | OneBotGroupAdminNoticeEvent
  | OneBotGroupDecreaseNoticeEvent
  | OneBotGroupIncreaseNoticeEvent
  | OneBotGroupBanNoticeEvent
  | OneBotFriendAddNoticeEvent
  | OneBotGroupRecallNoticeEvent
  | OneBotFriendRecallNoticeEvent
  | OneBotNotifyNoticeEvent;

export interface OneBotBaseNoticeEvent extends OneBotCommonEventFields {
  post_type: "notice";
  notice_type: string;
}

export interface OneBotGroupUploadNoticeEvent extends OneBotBaseNoticeEvent {
  notice_type: "group_upload";
  group_id: number;
  user_id: number;
  file: OneBotFileInfo;
}

export interface OneBotGroupAdminNoticeEvent extends OneBotBaseNoticeEvent {
  notice_type: "group_admin";
  sub_type: "set" | "unset" | string;
  group_id: number;
  user_id: number;
}

export interface OneBotGroupDecreaseNoticeEvent extends OneBotBaseNoticeEvent {
  notice_type: "group_decrease";
  sub_type: "leave" | "kick" | "kick_me" | string;
  group_id: number;
  operator_id: number;
  user_id: number;
}

export interface OneBotGroupIncreaseNoticeEvent extends OneBotBaseNoticeEvent {
  notice_type: "group_increase";
  sub_type: "approve" | "invite" | string;
  group_id: number;
  operator_id: number;
  user_id: number;
}

export interface OneBotGroupBanNoticeEvent extends OneBotBaseNoticeEvent {
  notice_type: "group_ban";
  sub_type: "ban" | "lift_ban" | string;
  group_id: number;
  operator_id: number;
  user_id: number;
  duration: number;
}

export interface OneBotFriendAddNoticeEvent extends OneBotBaseNoticeEvent {
  notice_type: "friend_add";
  user_id: number;
}

export interface OneBotGroupRecallNoticeEvent extends OneBotBaseNoticeEvent {
  notice_type: "group_recall";
  group_id: number;
  user_id: number;
  operator_id: number;
  message_id: number;
}

export interface OneBotFriendRecallNoticeEvent extends OneBotBaseNoticeEvent {
  notice_type: "friend_recall";
  user_id: number;
  message_id: number;
}

export type OneBotNotifyNoticeEvent =
  | OneBotPokeNotifyEvent
  | OneBotLuckyKingNotifyEvent
  | OneBotHonorNotifyEvent
  | OneBotUnknownNotifyEvent;

export interface OneBotPokeNotifyEvent extends OneBotBaseNoticeEvent {
  notice_type: "notify";
  sub_type: "poke";
  group_id?: number;
  user_id: number;
  target_id: number;
}

export interface OneBotLuckyKingNotifyEvent extends OneBotBaseNoticeEvent {
  notice_type: "notify";
  sub_type: "lucky_king";
  group_id: number;
  user_id: number;
  target_id: number;
}

export interface OneBotHonorNotifyEvent extends OneBotBaseNoticeEvent {
  notice_type: "notify";
  sub_type: "honor";
  group_id: number;
  user_id: number;
  honor_type: "talkative" | "performer" | "emotion" | string;
}

export interface OneBotUnknownNotifyEvent extends OneBotBaseNoticeEvent {
  notice_type: "notify";
  sub_type: string;
  group_id?: number;
  user_id?: number;
  target_id?: number;
  anonymous?: OneBotAnonymousInfo | null;
}

