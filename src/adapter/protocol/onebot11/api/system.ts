/**
 * OneBot v11 系统、凭证和状态相关 API 类型定义。
 */

import type { OneBotApiResponse } from "../common";
import type { OneBotStatus } from "../event";

export interface OneBotGetCookiesRequest {
  domain?: string;
}

export type OneBotGetCookiesResponse = OneBotApiResponse<{ cookies: string }>;
export type OneBotGetCsrfTokenResponse = OneBotApiResponse<{ token: number }>;

export interface OneBotGetCredentialsRequest {
  domain?: string;
}

export type OneBotGetCredentialsResponse = OneBotApiResponse<{
  cookies: string;
  csrf_token: number;
}>;

export type OneBotGetStatusResponse = OneBotApiResponse<OneBotStatus>;

export interface OneBotVersionInfo {
  app_name: string;
  app_version: string;
  protocol_version: string;
  [key: string]: unknown;
}

export type OneBotGetVersionInfoResponse = OneBotApiResponse<OneBotVersionInfo>;

export interface OneBotSetRestartRequest {
  delay?: number;
}

export interface OneBotCleanCacheRequest {
  [key: string]: never;
}

