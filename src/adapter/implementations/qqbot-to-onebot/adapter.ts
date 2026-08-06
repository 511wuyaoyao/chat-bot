/**
 * 基于 QQ 官方机器人 Gateway/Webhook 与 OpenAPI 的 OneBot11 子集适配器。
 */

import express, { Request, Response } from "express";
import http from "http";
import type {
  OneBot11AdapterOptions,
  OneBot11Runtime,
  OneBotDeleteMsgRequest,
  OneBotGetMsgData,
  OneBotGetMsgRequest,
  OneBotSendGroupMsgRequest,
  OneBotSendMsgData,
  OneBotSendMsgRequest,
  OneBotSendPrivateMsgRequest,
} from "../../protocol/onebot11";
import { QQBotOfficialClient } from "./client";
import { QQBotGatewayClient } from "./gateway";
import { oneBotMessageToQQBotPayload } from "./message";
import {
  officialMessageIdForOneBotMessageId,
  qqBotRawEventToOneBot11,
  referencedOfficialMessageId,
} from "./to-onebot11";
import type { QQBotGatewayTransport, QQBotWebhookPayload } from "./types";

const MAX_DELETE_MSG_MAPPING_SIZE = 1000;

type SentMessageTarget =
  | { type: "private"; targetId: string; msgId: string }
  | { type: "group"; targetId: string; msgId: string };

export interface QQBotToOneBot11AdapterOptions extends OneBot11AdapterOptions {
  appId: string;
  appSecret: string;
  apiBaseUrl?: string;
  apiTimeoutMs?: number;
  webhookPath?: string;
  transport?: QQBotGatewayTransport;
  intents?: number;
}

class QQBotBackedOneBot11Adapter implements OneBot11Runtime {
  private app = express();
  private server: http.Server | null = null;
  private client: QQBotOfficialClient;
  private gateway: QQBotGatewayClient;
  private sentMessages = new Map<number, SentMessageTarget>();
  private officialMessageIds = new Map<number, string>();

  constructor(private options: QQBotToOneBot11AdapterOptions) {
    this.client = new QQBotOfficialClient({
      appId: options.appId,
      appSecret: options.appSecret,
      apiBaseUrl: options.apiBaseUrl,
      apiTimeoutMs: options.apiTimeoutMs,
      logger: options.logger,
    });
    this.gateway = new QQBotGatewayClient({
      client: this.client,
      intents: options.intents,
      summaryMinutes: options.wsPingSummaryMinutes,
      rawEventLogEnabled: options.rawEventLogEnabled,
      logger: options.logger,
      onEvent: options.onEvent,
    });
    this.options.logger.info("QQ 官方机器人 OpenAPI client 已初始化", {
      api_base_url: options.apiBaseUrl,
      api_timeout_ms: options.apiTimeoutMs,
      pid: process.pid,
    });

    this.app.use(express.json());
    this.app.get("/health", (_req: Request, res: Response) => {
      res.json({ status: "ok", adapter: "qqbot-to-onebot", transport: this.transport });
    });
    this.app.post(this.webhookPath, async (req: Request, res: Response) => {
      await this.handleWebhook(req.body as QQBotWebhookPayload, res);
    });
  }

  start(): void {
    if (this.transport === "websocket") {
      void this.gateway.start();
      return;
    }

    this.server = http.createServer(this.app);
    this.server.listen(this.options.port, () => {
      this.options.logger.info(`QQ 官方机器人 OneBot11 子集适配器已启动，监听端口 ${this.options.port}`);
      this.options.logger.info(`QQ 官方机器人 Webhook 入口: http://127.0.0.1:${this.options.port}${this.webhookPath}`);
    });
  }

  stop(): void {
    this.gateway.stop();
    if (this.server) this.server.close();
    this.server = null;
  }

  async sendPrivateMsg(request: OneBotSendPrivateMsgRequest): Promise<OneBotSendMsgData | null> {
    try {
      const targetId = String(request.user_id);
      const payload = oneBotMessageToQQBotPayload(request.message);
      const referenceMessageId = this.resolveOfficialMessageId(payload.referenceMessageId);
      const response = await this.client.sendC2CMessage(
        targetId,
        payload.content,
        referenceMessageId
      );
      const msgId = this.extractOfficialMsgId(response);
      const data = this.toSendMsgData(msgId);
      if (msgId) this.rememberSentMessage(data.message_id, { type: "private", targetId, msgId });
      return data;
    } catch (err) {
      this.options.logger.error("QQ 官方机器人发送私聊消息失败", {
        user_id: request.user_id,
        error: String(err),
      });
      return null;
    }
  }

  async sendGroupMsg(request: OneBotSendGroupMsgRequest): Promise<OneBotSendMsgData | null> {
    try {
      const targetId = String(request.group_id);
      const payload = oneBotMessageToQQBotPayload(request.message);
      const referenceMessageId = this.resolveOfficialMessageId(payload.referenceMessageId);
      const response = await this.client.sendGroupMessage(
        targetId,
        payload.content,
        referenceMessageId
      );
      const msgId = this.extractOfficialMsgId(response);
      const data = this.toSendMsgData(msgId);
      if (msgId) this.rememberSentMessage(data.message_id, { type: "group", targetId, msgId });
      return data;
    } catch (err) {
      this.options.logger.error("QQ 官方机器人发送群消息失败", {
        group_id: request.group_id,
        error: String(err),
      });
      return null;
    }
  }

  async sendMsg(request: OneBotSendMsgRequest): Promise<OneBotSendMsgData | null> {
    if (request.message_type === "private" || request.user_id !== undefined) {
      return this.sendPrivateMsg({
        user_id: request.user_id ?? 0,
        message: request.message,
        auto_escape: request.auto_escape,
      });
    }

    if (request.message_type === "group" || request.group_id !== undefined) {
      return this.sendGroupMsg({
        group_id: request.group_id ?? 0,
        message: request.message,
        auto_escape: request.auto_escape,
      });
    }

    this.options.logger.warn("QQ 官方机器人 send_msg 缺少 message_type/user_id/group_id，无法路由");
    return null;
  }

  async deleteMsg(request: OneBotDeleteMsgRequest): Promise<boolean> {
    const mapped = this.sentMessages.get(request.message_id);
    const msgId = mapped?.msgId ?? String(request.message_id);
    const userId = request.user_id === undefined
      ? (mapped?.type === "private" ? mapped.targetId : undefined)
      : String(request.user_id);
    const groupId = request.group_id === undefined
      ? (mapped?.type === "group" ? mapped.targetId : undefined)
      : String(request.group_id);

    try {
      if (groupId) {
        await this.client.deleteGroupMessage(groupId, msgId);
      } else if (userId) {
        await this.client.deleteC2CMessage(userId, msgId);
      } else {
        this.options.logger.warn("QQ 官方机器人撤回消息失败：缺少 user_id/group_id", {
          message_id: request.message_id,
        });
        return false;
      }

      this.sentMessages.delete(request.message_id);
      this.options.logger.info("QQ 官方机器人消息已撤回", {
        message_id: request.message_id,
        message_type: groupId ? "group" : "private",
      });
      return true;
    } catch (err) {
      this.options.logger.error("QQ 官方机器人撤回消息失败", {
        message_id: request.message_id,
        message_type: groupId ? "group" : "private",
        error: String(err),
      });
      return false;
    }
  }

  async getMsg(_request: OneBotGetMsgRequest): Promise<OneBotGetMsgData | null> {
    this.options.logger.warn("QQ 官方机器人 OneBot11 子集暂不支持 get_msg");
    return null;
  }

  private async handleWebhook(payload: QQBotWebhookPayload, res: Response): Promise<void> {
    try {
      if (this.options.rawEventLogEnabled) {
        this.options.logger.debug("QQ 官方机器人原始事件", {
          event_type: payload.t,
          sequence: payload.s,
          raw_preview: this.safeJsonPreview(payload, 500),
        });
      }

      const event = qqBotRawEventToOneBot11(payload);
      if (event) {
        if (event.post_type === "message") {
          this.rememberOfficialMessageId(event.message_id, this.extractOfficialMsgIdFromPayload(payload));
          this.rememberReferencedOfficialMessageId(payload);
        }
        await this.options.onEvent(event);
      }
      res.json({ status: "ok" });
    } catch (err) {
      this.options.logger.warn("QQ 官方机器人 Webhook 事件处理失败", { error: String(err) });
      res.status(500).json({ status: "failed" });
    }
  }

  private toSendMsgData(messageId: string | undefined): OneBotSendMsgData {
    const numeric = Number(messageId);
    if (Number.isInteger(numeric) && numeric > 0 && numeric <= Number.MAX_SAFE_INTEGER) {
      return { message_id: numeric };
    }
    return { message_id: this.hashToPositiveInt(messageId ?? `${Date.now()}`) };
  }

  private extractOfficialMsgId(response: Record<string, unknown>): string | undefined {
    const value = response.id ?? response.msg_id ?? response.message_id;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "bigint") return String(value);
    return undefined;
  }

  private rememberSentMessage(messageId: number, target: SentMessageTarget): void {
    this.sentMessages.set(messageId, target);
    this.rememberOfficialMessageId(messageId, target.msgId);
    while (this.sentMessages.size > MAX_DELETE_MSG_MAPPING_SIZE) {
      const oldest = this.sentMessages.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      this.sentMessages.delete(oldest);
      this.officialMessageIds.delete(oldest);
    }
  }

  private resolveOfficialMessageId(oneBotMessageId: string | undefined): string | undefined {
    if (!oneBotMessageId) return undefined;
    const numeric = Number(oneBotMessageId);
    if (Number.isInteger(numeric)) {
      return this.officialMessageIds.get(numeric)
        ?? officialMessageIdForOneBotMessageId(numeric)
        ?? oneBotMessageId;
    }
    return oneBotMessageId;
  }

  private rememberOfficialMessageId(oneBotMessageId: number | undefined, officialMessageId: string | undefined): void {
    if (!oneBotMessageId || !officialMessageId) return;
    this.officialMessageIds.set(oneBotMessageId, officialMessageId);
    while (this.officialMessageIds.size > MAX_DELETE_MSG_MAPPING_SIZE) {
      const oldest = this.officialMessageIds.keys().next().value as number | undefined;
      if (oldest === undefined) break;
      this.officialMessageIds.delete(oldest);
    }
  }

  private extractOfficialMsgIdFromPayload(payload: QQBotWebhookPayload): string | undefined {
    const data = payload.d;
    const value = data?.msg_id ?? data?.id ?? data?.event_id ?? payload.id;
    if (typeof value === "string" && value.trim()) return value.trim();
    return undefined;
  }

  private rememberReferencedOfficialMessageId(payload: QQBotWebhookPayload): void {
    if (!payload.d) return;
    const officialMessageId = referencedOfficialMessageId(payload.d);
    if (!officialMessageId) return;
    this.rememberOfficialMessageId(this.hashToPositiveInt(officialMessageId), officialMessageId);
  }

  private hashToPositiveInt(value: string): number {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
      hash = Math.imul(31, hash) + value.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash) || 1;
  }

  private safeJsonPreview(value: unknown, maxLength: number): string {
    try {
      return JSON.stringify(value).slice(0, maxLength);
    } catch {
      return "[unserializable]";
    }
  }

  private get webhookPath(): string {
    return this.options.webhookPath ?? "/qqbot/webhook";
  }

  private get transport(): QQBotGatewayTransport {
    return this.options.transport ?? "websocket";
  }
}

export function createQQBotToOneBot11Adapter(options: QQBotToOneBot11AdapterOptions): OneBot11Runtime {
  return new QQBotBackedOneBot11Adapter(options);
}
