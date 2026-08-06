/**
 * OneBot11 运行适配器接口。
 */

import type {
  OneBotDeleteMsgRequest,
  OneBotGetMsgData,
  OneBotGetMsgRequest,
  OneBotSendGroupMsgRequest,
  OneBotSendMsgData,
  OneBotSendMsgRequest,
  OneBotSendPrivateMsgRequest,
} from "./api/message";
import type { OneBotEvent } from "./event";

export type OneBot11IncomingEvent = OneBotEvent;

export interface OneBot11Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface OneBot11AdapterOptions {
  onEvent: (event: OneBot11IncomingEvent) => Promise<void>;
  port: number;
  baseUrl: string;
  accessToken?: string;
  wsPingIntervalSeconds: number;
  wsPingSummaryMinutes: number;
  rawEventLogEnabled?: boolean;
  logger: OneBot11Logger;
}

export interface OneBot11ActionClient {
  sendPrivateMsg(request: OneBotSendPrivateMsgRequest): Promise<OneBotSendMsgData | null>;
  sendGroupMsg(request: OneBotSendGroupMsgRequest): Promise<OneBotSendMsgData | null>;
  sendMsg(request: OneBotSendMsgRequest): Promise<OneBotSendMsgData | null>;
  deleteMsg(request: OneBotDeleteMsgRequest): Promise<boolean>;
  getMsg(request: OneBotGetMsgRequest): Promise<OneBotGetMsgData | null>;
}

export interface OneBot11Runtime extends OneBot11ActionClient {
  start(): void;
  stop(): void;
}

