/**
 * OneBot v11 通信层载荷类型定义。
 */

import type { OneBotActionName, OneBotActionRequest, OneBotActionResponse } from "../api";
import type { OneBotEvent } from "../event";

export interface OneBotHttpActionRequest<TName extends OneBotActionName = OneBotActionName> {
  action: TName;
  params: OneBotActionRequest<TName>;
}

export interface OneBotWebSocketActionRequest<TName extends OneBotActionName = OneBotActionName> {
  action: TName;
  params?: OneBotActionRequest<TName>;
  echo?: unknown;
}

export type OneBotWebSocketActionResponse<TName extends OneBotActionName = OneBotActionName> =
  OneBotActionResponse<TName>;

export type OneBotReverseWebSocketPayload = OneBotEvent | OneBotWebSocketActionResponse;

export interface OneBotAuthorizationConfig {
  accessToken?: string;
}

