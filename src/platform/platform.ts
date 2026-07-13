/**
 * 平台运行入口，负责把外部协议事件处理成项目内部消息。
 */

import { config } from "../config";
import { messages } from "../prompt";
import { logger } from "../utils/logger";
import type { OneBot11IncomingEvent, OneBot11Runtime, OneBotGetMsgData } from "../adapter/protocol/onebot11";
import type { PlatformOptions, InternalReply, InternalMessageType } from "./internal";
import {
  getSelfSentPrivatePeerId,
  normalizeInternalMessage,
} from "./internal/onebot11";
import { buildMessageSegments } from "./internal/message-segments";
import { createOneBot11Adapter } from "../adapter/implementations/napcat-to-onebot";
import { renderMessageSegmentsToText } from "./message-segment-renderer";
import { processInternalMessage } from "./message-pipeline";
import { SelfChatEchoFilter } from "./self-chat-echo-filter";
import { SentMessageTracker } from "./sent-message-tracker";

interface PipelineFilterSample {
  category: string;
  reason: string;
  user_id: number;
  group_id?: number;
  message_id: number;
}

interface PipelineFilterStat {
  category: string;
  reason: string;
  count: number;
}

export class Platform {
  private transport: OneBot11Runtime = createOneBot11Adapter({
    onEvent: async (event) => this.handleEvent(event),
    port: config.qq.port,
    baseUrl: config.qq.napcatBaseUrl,
    accessToken: config.qq.napcatToken,
    wsPingIntervalSeconds: config.qq.wsPingIntervalSeconds,
    wsPingSummaryMinutes: config.qq.wsPingSummaryMinutes,
    rawEventLogEnabled: config.qq.napcatRawEventLogEnabled,
    logger,
  });
  private sentMessageTracker = new SentMessageTracker();
  private selfChatEchoFilter = new SelfChatEchoFilter();
  private currentSelfId: string | null = null;
  private readonly pipelineFilterSummaryIntervalMs = Math.max(
    60_000,
    config.qq.wsPingSummaryMinutes * 60_000
  );
  private pipelineFilterWindowStartedAt = Date.now();
  private pipelineFilterTotal = 0;
  private pipelineFilterStats = new Map<string, PipelineFilterStat>();
  private pipelineFilterLast: PipelineFilterSample | null = null;

  constructor(private options: PlatformOptions) {}

  start(): void {
    this.transport.start();
  }

  stop(): void {
    this.flushPipelineFilterSummary("stop");
    this.transport.stop();
  }

  private async handleEvent(event: OneBot11IncomingEvent): Promise<void> {
    this.rememberSelfId(event);
    if (event.post_type === "notice") {
      this.handleNoticeEvent(event);
      return;
    }

    const postType = String(event.post_type ?? "");
    if (postType !== "message" && postType !== "message_sent") return;
    await this.handleMessageEvent(event, postType);
  }

  private handleNoticeEvent(event: OneBot11IncomingEvent): void {
    const noticeType = String(event.notice_type ?? "");
    if (noticeType !== "friend_recall" && noticeType !== "group_recall") return;

    const messageId = Number(event.message_id);
    const userId = String(event.user_id ?? "");
    if (!messageId) return;

    logger.info("user recall notice", {
      user_id: userId,
      group_id: event.group_id,
      recalled_message_id: messageId,
      notice_type: noticeType,
    });
    this.options.onRecall?.(userId, messageId);
  }

  private async handleMessageEvent(event: OneBot11IncomingEvent, postType: string): Promise<void> {
    const selfId = this.getSelfId() ?? "";
    let privatePeerId: number | undefined;

    if (postType === "message_sent") {
      const messageId = Number(event.message_id);
      if (this.sentMessageTracker.consume(messageId)) return;

      if (event.message_type === "private") {
        privatePeerId = getSelfSentPrivatePeerId(event, selfId);
        if (!selfId || !privatePeerId || String(privatePeerId) !== selfId) return;
      }
    }

    const messageType = event.message_type as InternalMessageType;
    if (messageType !== "private" && messageType !== "group") return;

    const msg = normalizeInternalMessage(event, messageType, postType === "message_sent", privatePeerId);
    if (!msg) return;

    if (this.selfChatEchoFilter.consumeIfEcho(msg)) {
      logger.debug("忽略自聊回声消息", { message_id: msg.message_id });
      return;
    }

    const decision = processInternalMessage({
      messageType,
      userId: msg.user_id,
      groupId: msg.group_id,
      selfId,
      rawMessage: msg.original_raw_message ?? msg.raw_message,
      rawSegments: event.message,
      isSelfSent: msg.is_self_sent,
      userWhitelist: config.qq.userWhitelist,
      groupWhitelist: config.qq.groupWhitelist,
    });
    msg.category = decision.category;
    msg.raw_message = decision.rawMessage;

    if (!decision.accepted) {
      this.recordPipelineFilter({
        category: decision.category,
        reason: decision.reason ?? "unknown",
        user_id: msg.user_id,
        group_id: msg.group_id,
        message_id: msg.message_id,
      });
      return;
    }

    let imageProgressMessageId: number | null = null;
    const userId = String(msg.user_id);
    try {
      if (msg.reply) msg.reply = await this.hydrateReply(msg.reply);

      if (msg.reply) {
        msg.reply.parsed_message = await renderMessageSegmentsToText(msg.reply.raw_segments, {
          onImageRecognitionStart: async () => {
            if (imageProgressMessageId) return;
            imageProgressMessageId = await this.sendMessage(
              msg.message_type,
              userId,
              messages.qq.imageRecognitionProgress,
              msg.group_id
            );
          },
          onTokenUsage: (actor, usage) => {
            this.options.onTokenUsage?.(userId, actor, usage);
          },
        });
      }

      msg.raw_message = await renderMessageSegmentsToText(decision.messageSegments, {
        onImageRecognitionStart: async () => {
          if (imageProgressMessageId) return;
          imageProgressMessageId = await this.sendMessage(
            msg.message_type,
            userId,
            messages.qq.imageRecognitionProgress,
            msg.group_id
          );
        },
        onTokenUsage: (actor, usage) => {
          this.options.onTokenUsage?.(userId, actor, usage);
        },
      });
    } finally {
      if (imageProgressMessageId) await this.recallMessage(imageProgressMessageId);
    }

    if (!msg.raw_message.trim() && !msg.reply?.parsed_message?.trim()) return;

    logger.info("收到消息", {
      user_id: String(msg.user_id),
      group_id: msg.group_id,
      message_id: msg.message_id,
      message_type: msg.message_type,
      category: msg.category,
      text: msg.raw_message.substring(0, 50),
      ...(msg.reply ? { reply_to: msg.reply.message_id, reply_user: msg.reply.user_id } : {}),
    });

    try {
      await this.options.onMessage(msg);
    } catch (err) {
      logger.error("消息处理异常", { error: String(err) });
    }
  }

  private recordPipelineFilter(sample: PipelineFilterSample): void {
    const key = `${sample.category}:${sample.reason}`;
    const existing = this.pipelineFilterStats.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      this.pipelineFilterStats.set(key, {
        category: sample.category,
        reason: sample.reason,
        count: 1,
      });
    }

    this.pipelineFilterTotal += 1;
    this.pipelineFilterLast = sample;

    if (Date.now() - this.pipelineFilterWindowStartedAt >= this.pipelineFilterSummaryIntervalMs) {
      this.flushPipelineFilterSummary("interval");
    }
  }

  private flushPipelineFilterSummary(_trigger: "interval" | "stop"): void {
    if (this.pipelineFilterTotal === 0) return;

    this.pipelineFilterWindowStartedAt = Date.now();
    this.pipelineFilterTotal = 0;
    this.pipelineFilterStats.clear();
    this.pipelineFilterLast = null;
  }

  async sendMessage(
    type: "private" | "group",
    userId: string,
    message: string,
    groupId?: number
  ): Promise<number | null> {
    const shouldTrackSelfChatEcho = type === "private" && userId === this.currentSelfId;
    if (shouldTrackSelfChatEcho) this.selfChatEchoFilter.remember(message);

    const targetGroupId = type === "group" && typeof groupId === "number" ? groupId : null;
    if (type === "group" && targetGroupId === null) {
      logger.error("发送群消息失败：缺少 group_id", { type, user_id: userId });
      return null;
    }

    const response = type === "private"
      ? await this.transport.sendPrivateMsg({ user_id: Number(userId), message })
      : await this.transport.sendGroupMsg({ group_id: targetGroupId!, message });
    const messageId = response?.message_id ?? null;
    if (!messageId) {
      if (shouldTrackSelfChatEcho) this.selfChatEchoFilter.forget(message);
      return null;
    }

    logger.info("消息已发送", { type, user_id: userId, message_id: messageId });
    this.sentMessageTracker.remember(messageId);
    return messageId;
  }

  recallMessage(messageId: number): Promise<boolean> {
    return this.transport.deleteMsg({ message_id: messageId });
  }

  getSelfId(): string | null {
    return this.currentSelfId;
  }

  private rememberSelfId(event: OneBot11IncomingEvent): void {
    const selfId = String(event.self_id ?? "").trim();
    if (selfId) this.currentSelfId = selfId;
  }
  private async hydrateReply(reply: InternalReply): Promise<InternalReply> {
    if (reply.raw_message || (Array.isArray(reply.raw_segments) && reply.raw_segments.length > 0)) {
      return reply;
    }

    const data = await this.transport.getMsg({ message_id: reply.message_id });
    if (!data) return reply;

    const normalized = data as OneBotGetMsgData & {
      sender?: Record<string, unknown>;
      user_id?: unknown;
      raw_message?: unknown;
      message?: unknown;
    };
    const sender = normalized.sender;
    const userId = Number(sender?.user_id ?? normalized.user_id ?? reply.user_id);
    const rawMessage = String(normalized.raw_message ?? reply.raw_message ?? "");
    return {
      ...reply,
      user_id: userId || reply.user_id,
      raw_message: rawMessage,
      raw_segments: Array.isArray(normalized.message) ? normalized.message : buildMessageSegments(rawMessage),
    };
  }
}

