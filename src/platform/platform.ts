/**
 * 平台运行入口，负责把外部协议事件处理成项目内部消息。
 */

import { config } from "../config/output";
import { findUserByAccount } from "../config/identity";
import { messages } from "../prompt";
import { logger } from "../utils/logger";
import type {
  OneBot11IncomingEvent,
  OneBot11Runtime,
  OneBotGetMsgData,
  OneBotMessageEvent,
  OneBotNoticeEvent,
} from "../adapter/protocol/onebot11";
import type { PlatformOptions, InternalReply, InternalMessageType } from "./internal";
import { normalizeInternalMessage } from "./internal/onebot11";
import { buildMessageSegments } from "./internal/message-segments";
import { createOneBot11Adapter, createQQBotToOneBot11Adapter } from "../adapter/output";
import { renderMessageSegmentsToText } from "./message-segment-renderer";
import { processInternalMessage } from "./message-pipeline";
import { SelfChatEchoFilter } from "./self-chat-echo-filter";
import { SentMessageTracker } from "./sent-message-tracker";

interface PipelineFilterSample {
  category: string;
  reason: string;
  user_id: string | number;
  group_id?: string | number;
  message_id: number;
}

interface PipelineFilterStat {
  category: string;
  reason: string;
  count: number;
}

export class Platform {
  private transport: OneBot11Runtime = this.createTransport();
  private started = false;
  private sentMessageTracker = new SentMessageTracker();
  private selfChatEchoFilter = new SelfChatEchoFilter();
  private currentSelfId: string | null = null;
  private pipelineFilterWindowStartedAt = Date.now();
  private pipelineFilterTotal = 0;
  private pipelineFilterStats = new Map<string, PipelineFilterStat>();
  private pipelineFilterLast: PipelineFilterSample | null = null;

  constructor(private options: PlatformOptions) {}

  start(): void {
    this.started = true;
    this.transport.start();
  }

  stop(): void {
    this.started = false;
    this.flushPipelineFilterSummary("stop");
    this.transport.stop();
  }

  reloadTransport(): void {
    const adapter = config.platform.adapter;
    const wasStarted = this.started;
    this.flushPipelineFilterSummary("reload");
    this.transport.stop();
    this.currentSelfId = null;
    this.started = false;
    setTimeout(() => {
      this.transport = this.createTransport();
      if (wasStarted) {
        this.started = true;
        this.transport.start();
      }
    }, 250);
    logger.info("平台适配器已热加载", { adapter });
  }

  private createTransport(): OneBot11Runtime {
    if (config.platform.adapter === "qqbot-official") {
      return createQQBotToOneBot11Adapter({
        onEvent: async (event) => this.handleEvent(event),
        port: config.qq.port,
        baseUrl: config.qq.napcatBaseUrl,
        appId: config.qq.qqbot.appId,
        appSecret: config.qq.qqbot.appSecret,
        apiBaseUrl: config.qq.qqbot.apiBaseUrl,
        apiTimeoutMs: config.qq.qqbot.apiTimeoutMs,
        transport: config.qq.qqbot.transport,
        webhookPath: config.qq.qqbot.webhookPath,
        wsPingIntervalSeconds: config.qq.wsPingIntervalSeconds,
        wsPingSummaryMinutes: config.qq.wsPingSummaryMinutes,
        rawEventLogEnabled: config.qq.qqbot.rawEventLogEnabled,
        logger,
      });
    }

    return createOneBot11Adapter({
      onEvent: async (event) => this.handleEvent(event),
      port: config.qq.port,
      baseUrl: config.qq.napcatBaseUrl,
      accessToken: config.qq.napcatToken,
      wsPingIntervalSeconds: config.qq.wsPingIntervalSeconds,
      wsPingSummaryMinutes: config.qq.wsPingSummaryMinutes,
      rawEventLogEnabled: config.qq.napcatRawEventLogEnabled,
      logger,
    });
  }

  private async handleEvent(event: OneBot11IncomingEvent): Promise<void> {
    this.rememberSelfId(event);
    if (event.post_type === "notice") {
      this.handleNoticeEvent(event);
      return;
    }

    if (event.post_type !== "message") return;
    await this.handleMessageEvent(event);
  }

  private handleNoticeEvent(event: OneBotNoticeEvent): void {
    if (event.notice_type !== "friend_recall" && event.notice_type !== "group_recall") return;

    const messageId = Number(event.message_id);
    const externalUserId = String(event.user_id ?? "");
    const resolvedUser = findUserByAccount(
      config.qq.accountToUser,
      config.platform.adapter,
      externalUserId
    );
    const personId = resolvedUser?.id ?? externalUserId;
    if (!messageId) return;

    logger.info("user recall notice", {
      user_id: externalUserId,
      person_id: personId,
      group_id: event.notice_type === "group_recall" ? event.group_id : undefined,
      recalled_message_id: messageId,
      notice_type: event.notice_type,
    });
    this.options.onRecall?.(personId, messageId);
  }

  private async handleMessageEvent(event: OneBotMessageEvent): Promise<void> {
    const selfId = this.getSelfId() ?? "";

    const messageType = event.message_type as InternalMessageType;
    if (messageType !== "private" && messageType !== "group") return;

    if (this.sentMessageTracker.consume(Number(event.message_id))) return;

    const msg = normalizeInternalMessage(event, messageType, false);
    if (!msg) return;
    const originalUserId = msg.user_id;
    const resolvedUser = findUserByAccount(
      config.qq.accountToUser,
      config.platform.adapter,
      String(originalUserId)
    );
    const userRegistered = Boolean(resolvedUser);
    if (resolvedUser) msg.person_id = resolvedUser.id;
    const personId = String(msg.person_id ?? msg.user_id);

    if (this.selfChatEchoFilter.consumeIfEcho(msg)) {
      logger.debug("忽略自聊回声消息", { message_id: msg.message_id });
      return;
    }

    const decision = processInternalMessage({
      messageType,
      userId: msg.user_id,
      personId: msg.person_id,
      groupId: msg.group_id,
      selfId,
      rawMessage: msg.original_raw_message ?? msg.raw_message,
      rawSegments: event.message,
      isSelfSent: msg.is_self_sent,
      userRegistered,
      userWhitelist: config.qq.userWhitelist,
      groupWhitelist: config.qq.groupWhitelist,
    });
    msg.category = decision.category;
    msg.raw_message = decision.rawMessage;

    if (!decision.accepted) {
      logger.info("消息已被平台过滤", {
        category: decision.category,
        reason: decision.reason ?? "unknown",
        user_id: String(msg.user_id),
        person_id: msg.person_id,
        group_id: msg.group_id === undefined ? undefined : String(msg.group_id),
        message_id: msg.message_id,
        message_type: msg.message_type,
      });
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
            this.options.onTokenUsage?.(personId, actor, usage);
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
          this.options.onTokenUsage?.(personId, actor, usage);
        },
      });
    } finally {
      if (imageProgressMessageId) {
        await this.recallMessage(imageProgressMessageId, {
          userId: msg.message_type === "private" ? userId : undefined,
          groupId: msg.message_type === "group" ? msg.group_id : undefined,
        });
      }
    }

    if (!msg.raw_message.trim() && !msg.reply?.parsed_message?.trim()) return;

    logger.info("收到消息", {
      user_id: String(msg.user_id),
      person_id: msg.person_id,
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

    if (Date.now() - this.pipelineFilterWindowStartedAt >= this.pipelineFilterSummaryIntervalMs()) {
      this.flushPipelineFilterSummary("interval");
    }
  }

  private pipelineFilterSummaryIntervalMs(): number {
    return Math.max(60_000, config.qq.wsPingSummaryMinutes * 60_000);
  }

  private flushPipelineFilterSummary(_trigger: "interval" | "stop" | "reload"): void {
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
    groupId?: string | number
  ): Promise<number | null> {
    const shouldTrackSelfChatEcho = type === "private" && userId === this.currentSelfId;
    if (shouldTrackSelfChatEcho) this.selfChatEchoFilter.remember(message);

    const targetGroupId = type === "group" && groupId !== undefined && groupId !== null && String(groupId) !== "" ? groupId : null;
    if (type === "group" && targetGroupId === null) {
      logger.error("发送群消息失败：缺少 group_id", { type, user_id: userId });
      return null;
    }

    const privateTargetId = type === "private" ? this.resolvePrivateTarget(userId) : null;
    if (type === "private" && !privateTargetId) {
      if (shouldTrackSelfChatEcho) this.selfChatEchoFilter.forget(message);
      return null;
    }

    const response = type === "private"
      ? await this.transport.sendPrivateMsg({ user_id: privateTargetId!, message })
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

  private resolvePrivateTarget(userIdOrPersonId: string): string | null {
    const user = config.qq.users.find((item) => item.id === userIdOrPersonId);
    if (!user) return userIdOrPersonId;
    return this.resolvePrimaryPrivateTarget(userIdOrPersonId);
  }

  private resolvePrimaryPrivateTarget(personId: string): string | null {
    const user = config.qq.users.find((item) => item.id === personId);
    if (!user) {
      logger.error("发送私聊消息失败：未找到 person 配置", { user_id: personId });
      return null;
    }

    if (user.primaryAccount.platform !== config.platform.adapter) {
      logger.error("发送私聊消息失败：primaryAccount 平台与当前 adapter 不匹配", {
        user_id: personId,
        primary_platform: user.primaryAccount.platform,
        adapter: config.platform.adapter,
      });
      return null;
    }

    return user.primaryAccount.id;
  }

  recallMessage(messageId: number, target?: { userId?: string | number; groupId?: string | number }): Promise<boolean> {
    return this.transport.deleteMsg({
      message_id: messageId,
      user_id: target?.userId,
      group_id: target?.groupId,
    });
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
    const userId = sender?.user_id ?? normalized.user_id ?? reply.user_id;
    const rawMessage = String(normalized.raw_message ?? reply.raw_message ?? "");
    return {
      ...reply,
      user_id: userId === undefined || userId === null || userId === "" ? reply.user_id : String(userId),
      raw_message: rawMessage,
      raw_segments: Array.isArray(normalized.message) ? normalized.message : buildMessageSegments(rawMessage),
    };
  }
}
