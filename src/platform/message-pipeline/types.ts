/**
 * 平台消息处理流水线类型。
 * 定义处理输入、输出和处理器接口。
 */

import type { OneBotMessageSegment } from "../../adapter/protocol/onebot11";
import type { InternalMessageCategory, InternalMessageType, InternalPlatformId } from "../internal";

export interface InternalMessagePipelineInput {
  messageType: InternalMessageType;
  userId: InternalPlatformId;
  personId?: string;
  groupId?: InternalPlatformId;
  selfId: string;
  rawMessage: string;
  rawSegments?: unknown;
  isSelfSent?: boolean;
  userRegistered: boolean;
  userWhitelist: string[];
  groupWhitelist: string[];
}

export interface InternalMessagePipelineResult {
  category: InternalMessageCategory;
  accepted: boolean;
  rawMessage: string;
  messageSegments: OneBotMessageSegment[];
  reason?: string;
}

export interface InternalMessagePipelineHandler {
  category: InternalMessageCategory;
  match(input: InternalMessagePipelineInput): boolean;
  process(input: InternalMessagePipelineInput): InternalMessagePipelineResult;
}

