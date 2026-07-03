/**
 * QQ 消息处理流水线类型
 * 定义处理输入、输出和处理器接口。
 */

import { QqMessageCategory, QqMessageType } from "../interface";

export interface OneBotMessageSegment {
  type?: string;
  data?: Record<string, unknown>;
}

export interface QqMessagePipelineInput {
  messageType: QqMessageType;
  userId: number;
  groupId?: number;
  selfId: string;
  rawMessage: string;
  rawSegments?: unknown;
  isSelfSent?: boolean;
  userWhitelist: string[];
  groupWhitelist: string[];
}

export interface QqMessagePipelineResult {
  category: QqMessageCategory;
  accepted: boolean;
  rawMessage: string;
  messageSegments: OneBotMessageSegment[];
  reason?: string;
}

export interface QqMessagePipelineHandler {
  category: QqMessageCategory;
  match(input: QqMessagePipelineInput): boolean;
  process(input: QqMessagePipelineInput): QqMessagePipelineResult;
}
