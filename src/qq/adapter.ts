/**
 * QQ 平台适配器
 * 负责接入 NapCat WebSocket 事件，并通过 NapCat HTTP API 发送和撤回消息。
 */

import express, { Request, Response } from "express";
import http from "http";
import { WebSocket, WebSocketServer } from "ws";
import { config } from "../config";
import { messages } from "../prompt";
import { logger } from "../utils/logger";
import { WsPing } from "./connection";
import {
  getSelfSentPrivatePeerId,
  normalizeQqMessage,
  OneBotEvent,
} from "./event-normalizer";
import {
  OneBotApiResponse,
  QqAdapterOptions,
  QqMessage,
  QqReply,
  QqMessageType,
} from "./interface";
import { renderMessageSegmentsToText } from "./message-segment-renderer";
import { processQqMessage } from "./message-pipeline";
import { buildMessageSegments } from "./message-pipeline/message-segments";
import { SelfChatEchoFilter } from "./self-chat-echo-filter";
import { SentMessageTracker } from "./sent-message-tracker";

export type { QqAdapterOptions, QqMessage, QqReply } from "./interface";

const napcatUrl = process.env.NAPCAT_BASE_URL || "http://127.0.0.1:3000";

export class QqAdapter {
  private app = express();
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private currentWs: WebSocket | null = null;
  private sentMessageTracker = new SentMessageTracker();
  private selfChatEchoFilter = new SelfChatEchoFilter();

  constructor(private options: QqAdapterOptions) {
    this.app.use(express.json());
    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({ status: "ok" });
    });
  }

  start(): void {
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server, path: "/ws" });

    let napcatConnected = false;

    this.wss.on("connection", (ws: WebSocket) => {
      if (this.currentWs && this.currentWs.readyState === WebSocket.OPEN) {
        logger.warn("收到新的 NapCat WebSocket 连接，关闭旧连接");
        this.currentWs.close(1000, "new connection replaced old one");
      }

      this.currentWs = ws;
      napcatConnected = true;
      logger.info("NapCat WebSocket 已连接");

      const wsPing = new WsPing(ws);
      wsPing.start();

      ws.on("message", async (data) => {
        const raw = data.toString();
        try {
          const event = JSON.parse(raw);
          await this.handleEvent(event);
        } catch {
          // 非 JSON 消息忽略。
        }
      });

      ws.on("close", (code, reason) => {
        wsPing.stop();
        if (this.currentWs === ws) {
          this.currentWs = null;
          napcatConnected = false;
        }
        logger.warn("NapCat WebSocket 断开，QQ 消息接收已中断，等待 NapCat 自动重连", {
          code,
          reason: reason.toString(),
        });
      });

      ws.on("error", (err) => {
        logger.error("WebSocket 错误", { error: err.message });
      });
    });

    this.server.listen(config.qq.port, () => {
      logger.info(`QQ 适配器已启动，监听端口 ${config.qq.port}`);
      logger.info(`等待 NapCat 反向 WS 连接: ws://127.0.0.1:${config.qq.port}/ws`);

      setTimeout(() => {
        if (!napcatConnected) {
          logger.warn("NapCat 未连接：启动 10 秒后仍未收到 NapCat WebSocket 连接");
          logger.warn("请检查 NapCatQQ 是否已启动，以及 NapCat WebSocket 客户端地址是否正确");
        }
      }, 10_000);
    });
  }

  private async handleEvent(event: OneBotEvent): Promise<void> {
    if (event.post_type === "notice") {
      this.handleNoticeEvent(event);
      return;
    }

    const postType = String(event.post_type ?? "");
    if (postType !== "message" && postType !== "message_sent") return;
    await this.handleMessageEvent(event, postType);
  }

  private handleNoticeEvent(event: OneBotEvent): void {
    const noticeType = String(event.notice_type ?? "");
    if (noticeType !== "friend_recall" && noticeType !== "group_recall") return;

    const messageId = Number(event.message_id);
    const userId = String(event.user_id ?? "");
    if (!messageId) return;

    logger.debug("用户撤回消息", {
      user_id: userId,
      group_id: event.group_id,
      message_id: messageId,
      notice_type: noticeType,
    });
    this.options.onRecall?.(userId, messageId);
  }

  private async handleMessageEvent(event: OneBotEvent, postType: string): Promise<void> {
    let privatePeerId: number | undefined;

    if (postType === "message_sent") {
      const messageId = Number(event.message_id);
      if (this.sentMessageTracker.consume(messageId)) return;

      if (event.message_type === "private") {
        privatePeerId = getSelfSentPrivatePeerId(event, config.qq.selfId);
        if (!privatePeerId || String(privatePeerId) !== config.qq.selfId) return;
      }
    }

    const messageType = event.message_type as QqMessageType;
    if (messageType !== "private" && messageType !== "group") return;

    const msg = normalizeQqMessage(event, messageType, postType === "message_sent", privatePeerId);
    if (!msg) return;

    if (this.selfChatEchoFilter.consumeIfEcho(msg)) {
      logger.debug("忽略自聊回声消息", { message_id: msg.message_id });
      return;
    }

    const decision = processQqMessage({
      messageType,
      userId: msg.user_id,
      groupId: msg.group_id,
      selfId: config.qq.selfId,
      rawMessage: msg.original_raw_message ?? msg.raw_message,
      rawSegments: event.message,
      isSelfSent: msg.is_self_sent,
      userWhitelist: config.qq.userWhitelist,
      groupWhitelist: config.qq.groupWhitelist,
    });
    msg.category = decision.category;
    msg.raw_message = decision.rawMessage;

    if (!decision.accepted) {
      logger.debug("QQ 消息流水线过滤", {
        category: decision.category,
        reason: decision.reason,
        user_id: msg.user_id,
        group_id: msg.group_id,
        message_id: msg.message_id,
      });
      return;
    }

    let imageProgressMessageId: number | null = null;
    const userId = String(msg.user_id);
    try {
      if (msg.reply) {
        msg.reply = await this.hydrateReply(msg.reply);
      }

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
      if (imageProgressMessageId) {
        await this.recallMessage(imageProgressMessageId);
      }
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

  /** 发送消息，返回 message_id，用于后续撤回和 message_sent 回声过滤。 */
  async sendMessage(
    type: "private" | "group",
    userId: string,
    message: string,
    groupId?: number
  ): Promise<number | null> {
    const shouldTrackSelfChatEcho = type === "private" && userId === config.qq.selfId;
    if (shouldTrackSelfChatEcho) this.selfChatEchoFilter.remember(message);

    try {
      const response = await this.sendNapCatMessage(type, userId, message, groupId);
      const parsed = JSON.parse(response) as OneBotApiResponse;
      const ok = parsed.status === "ok" || parsed.retcode === 0;
      if (!ok) {
        throw new Error(`NapCat API 返回失败：${response.substring(0, 300)}`);
      }

      const messageId = parsed.data?.message_id || null;
      if (!messageId) {
        throw new Error(`NapCat API 未返回 message_id：${response.substring(0, 300)}`);
      }

      logger.info("消息已发送", { type, user_id: userId, message_id: messageId });
      this.sentMessageTracker.remember(messageId);
      return messageId;
    } catch (err) {
      if (shouldTrackSelfChatEcho) this.selfChatEchoFilter.forget(message);
      const reason = (err as NodeJS.ErrnoException).code === "ECONNREFUSED"
        ? `NapCat HTTP API 不可达 (${napcatUrl})，请确认 NapCatQQ 已启动且 HTTP 服务端口正确`
        : `发送消息失败：${String(err)}`;
      logger.error(reason, { type, user_id: userId });
      return null;
    }
  }

  async recallMessage(messageId: number): Promise<boolean> {
    try {
      const response = await this.httpPost(`${napcatUrl}/delete_msg`, {
        message_id: messageId,
      });
      const parsed = JSON.parse(response) as OneBotApiResponse;
      const ok = parsed.status === "ok" || parsed.retcode === 0;
      logger.debug(ok ? `消息已撤回: ${messageId}` : `撤回失败: ${messageId}`, {
        response: response.substring(0, 100),
      });
      return ok;
    } catch (err) {
      logger.error("撤回消息失败", { error: String(err), message_id: messageId });
      return false;
    }
  }

  private async hydrateReply(reply: QqReply): Promise<QqReply> {
    if (reply.raw_message || (Array.isArray(reply.raw_segments) && reply.raw_segments.length > 0)) {
      return reply;
    }

    try {
      const response = await this.httpPost(`${napcatUrl}/get_msg`, {
        message_id: reply.message_id,
      });
      const parsed = JSON.parse(response) as OneBotApiResponse & {
        data?: (Record<string, unknown> & {
          sender?: Record<string, unknown>;
          message?: unknown;
        }) | null;
      };
      const data = parsed.data;
      if (!data) return reply;

      const sender = data.sender;
      const userId = Number(sender?.user_id ?? data.user_id ?? reply.user_id);
      const rawMessage = String(data.raw_message ?? reply.raw_message ?? "");
      return {
        ...reply,
        user_id: userId || reply.user_id,
        raw_message: rawMessage,
        raw_segments: Array.isArray(data.message) ? data.message : buildMessageSegments(rawMessage),
      };
    } catch (err) {
      logger.warn("读取引用消息失败", { message_id: reply.message_id, error: String(err) });
      return reply;
    }
  }

  private sendNapCatMessage(
    type: "private" | "group",
    userId: string,
    message: string,
    groupId?: number
  ): Promise<string> {
    if (type === "private") {
      return this.httpPost(`${napcatUrl}/send_private_msg`, {
        user_id: Number(userId),
        message,
      });
    }

    if (type === "group" && groupId) {
      return this.httpPost(`${napcatUrl}/send_group_msg`, {
        group_id: groupId,
        message,
      });
    }

    throw new Error("发送群消息缺少 group_id");
  }

  private httpPost(url: string, body: unknown): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const urlObj = new URL(url);
      let path = urlObj.pathname;
      if (config.qq.napcatToken) {
        path += `?access_token=${config.qq.napcatToken}`;
      }

      const req = http.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port,
          path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": String(Buffer.byteLength(data)),
          },
        },
        (res) => {
          let responseBody = "";
          res.on("data", (chunk) => (responseBody += chunk));
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${responseBody.substring(0, 300)}`));
              return;
            }
            resolve(responseBody);
          });
        }
      );

      req.setTimeout(15_000, () => {
        req.destroy(new Error("NapCat HTTP API 请求超时"));
      });
      req.on("error", reject);
      req.write(data);
      req.end();
    });
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }
  }
}
