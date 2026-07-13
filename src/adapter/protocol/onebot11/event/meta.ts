/**
 * OneBot v11 元事件类型定义。
 */

import type { OneBotCommonEventFields } from "../common";

export type OneBotMetaEvent = OneBotLifecycleMetaEvent | OneBotHeartbeatMetaEvent;

export interface OneBotBaseMetaEvent extends OneBotCommonEventFields {
  post_type: "meta_event";
  meta_event_type: string;
}

export interface OneBotLifecycleMetaEvent extends OneBotBaseMetaEvent {
  meta_event_type: "lifecycle";
  sub_type: "enable" | "disable" | "connect" | string;
}

export interface OneBotHeartbeatMetaEvent extends OneBotBaseMetaEvent {
  meta_event_type: "heartbeat";
  status: OneBotStatus;
  interval: number;
}

export interface OneBotStatus {
  online: boolean;
  good: boolean;
  [key: string]: unknown;
}

