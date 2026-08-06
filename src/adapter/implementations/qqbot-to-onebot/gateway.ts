/**
 * QQ 官方机器人 WebSocket Gateway 主动连接客户端。
 */

import WebSocket from "ws";
import type { OneBot11IncomingEvent, OneBot11Logger } from "../../protocol/onebot11";
import { QQBotOfficialClient } from "./client";
import { qqBotRawEventToOneBot11 } from "./to-onebot11";
import type { QQBotGatewayPayload, QQBotMessageEvent, QQBotWebhookPayload } from "./types";

const OPCODE_DISPATCH = 0;
const OPCODE_HEARTBEAT = 1;
const OPCODE_IDENTIFY = 2;
const OPCODE_RECONNECT = 7;
const OPCODE_INVALID_SESSION = 9;
const OPCODE_HELLO = 10;
const OPCODE_HEARTBEAT_ACK = 11;

const GROUP_AND_C2C_EVENT_INTENT = 1 << 25;
const DEFAULT_RECONNECT_DELAY_MS = 5_000;

export interface QQBotGatewayClientOptions {
  client: QQBotOfficialClient;
  intents?: number;
  summaryMinutes: number;
  rawEventLogEnabled?: boolean;
  logger: OneBot11Logger;
  onEvent: (event: OneBot11IncomingEvent) => Promise<void>;
}

export class QQBotGatewayClient {
  private ws: WebSocket | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private heartbeatSummaryTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private seq: number | null = null;
  private sessionId = "";
  private closedByUser = false;
  private connecting = false;
  private awaitingHeartbeatAck = false;
  private heartbeatTotal = 0;
  private heartbeatAckTotal = 0;
  private heartbeatRecent = 0;
  private heartbeatAckRecent = 0;

  constructor(private options: QQBotGatewayClientOptions) {}

  async start(): Promise<void> {
    if (this.connecting || this.ws?.readyState === WebSocket.OPEN) return;
    this.closedByUser = false;
    await this.connect();
  }

  stop(): void {
    this.closedByUser = true;
    this.clearHeartbeat();
    this.clearReconnect();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
  }

  private async connect(): Promise<void> {
    this.connecting = true;
    try {
      const gateway = await this.options.client.getGatewayBot();
      if (!gateway.url) throw new Error("QQ 官方 Gateway 响应缺少 url");

      this.options.logger.info("正在主动连接 QQ 官方 Bot Gateway", {
        url: this.redactGatewayUrl(gateway.url),
        shards: gateway.shards,
        session_remaining: gateway.session_start_limit?.remaining,
      });

      this.ws = new WebSocket(gateway.url);
      this.ws.on("open", () => {
        this.options.logger.info("QQ 官方 Bot Gateway WebSocket 已打开");
      });
      this.ws.on("message", (data) => {
        void this.handleMessage(data.toString());
      });
      this.ws.on("close", (code, reason) => {
        this.options.logger.warn("QQ 官方 Bot Gateway WebSocket 已关闭", {
          code,
          reason: reason.toString(),
        });
        this.clearHeartbeat();
        this.ws = null;
        this.scheduleReconnect();
      });
      this.ws.on("error", (err) => {
        this.options.logger.warn("QQ 官方 Bot Gateway WebSocket 异常", { error: String(err) });
      });
    } catch (err) {
      this.options.logger.error("QQ 官方 Bot Gateway 主动连接失败", { error: String(err) });
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private async handleMessage(raw: string): Promise<void> {
    let payload: QQBotGatewayPayload;
    try {
      payload = JSON.parse(raw) as QQBotGatewayPayload;
    } catch {
      this.options.logger.warn("QQ 官方 Bot Gateway 收到非 JSON 消息");
      return;
    }

    if (typeof payload.s === "number") this.seq = payload.s;

    if (this.options.rawEventLogEnabled) {
      this.options.logger.debug("QQ 官方 Bot Gateway 原始事件", {
        op: payload.op,
        event_type: payload.t,
        sequence: payload.s,
        raw_preview: raw.slice(0, 500),
      });
    }

    if (payload.op === OPCODE_HELLO) {
      await this.handleHello(payload.d);
      return;
    }

    if (payload.op === OPCODE_DISPATCH) {
      await this.handleDispatch(payload);
      return;
    }

    if (payload.op === OPCODE_HEARTBEAT_ACK) {
      this.awaitingHeartbeatAck = false;
      this.heartbeatAckTotal += 1;
      this.heartbeatAckRecent += 1;
      return;
    }

    if (payload.op === OPCODE_RECONNECT || payload.op === OPCODE_INVALID_SESSION) {
      this.options.logger.warn("QQ 官方 Bot Gateway 要求重连", { op: payload.op });
      this.reconnectNow();
    }
  }

  private async handleHello(data: unknown): Promise<void> {
    const heartbeatInterval = this.readHeartbeatInterval(data);
    this.startHeartbeat(heartbeatInterval);

    const token = await this.options.client.getGatewayIdentifyToken();
    this.send({
      op: OPCODE_IDENTIFY,
      d: {
        token,
        intents: this.options.intents ?? GROUP_AND_C2C_EVENT_INTENT,
        shard: [0, 1],
        properties: {
          os: process.platform,
          browser: "qqbot-to-onebot",
          device: "qqbot-to-onebot",
        },
      },
    });
  }

  private async handleDispatch(payload: QQBotGatewayPayload): Promise<void> {
    if (payload.t === "READY") {
      const data = payload.d as Record<string, unknown> | undefined;
      this.sessionId = String(data?.session_id ?? "");
      this.options.logger.info("QQ 官方 Bot Gateway 鉴权成功", { session_id: this.sessionId });
      return;
    }

    this.options.logger.info("QQ 官方 Bot Gateway 收到事件", {
      event_type: payload.t,
      sequence: payload.s,
      ...pickOfficialReferenceFields(payload.d),
    });

    const event = qqBotRawEventToOneBot11({
      op: payload.op,
      s: payload.s ?? undefined,
      t: payload.t,
      d: payload.d as QQBotMessageEvent | undefined,
    } as QQBotWebhookPayload);
    if (event) {
      await this.options.onEvent(event);
    } else {
      this.options.logger.debug("QQ 官方 Bot Gateway 事件未映射到 OneBot11", {
        event_type: payload.t,
        sequence: payload.s,
      });
    }
  }

  private startHeartbeat(intervalMs: number): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.sendHeartbeat();
    }, intervalMs);
    this.heartbeatSummaryTimer = setInterval(() => {
      this.options.logger.debug("QQ 官方 Bot Gateway 心跳统计", {
        __terminalFoldKey: "qqbot-gateway-heartbeat-summary",
        heartbeatTotal: this.heartbeatTotal,
        heartbeatAckTotal: this.heartbeatAckTotal,
        heartbeatRecent: this.heartbeatRecent,
        heartbeatAckRecent: this.heartbeatAckRecent,
        sequence: this.seq,
      });
      this.heartbeatRecent = 0;
      this.heartbeatAckRecent = 0;
    }, Math.max(1, this.options.summaryMinutes) * 60_000);
  }

  private sendHeartbeat(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    if (this.awaitingHeartbeatAck) {
      this.options.logger.warn("QQ 官方 Bot Gateway 心跳 ACK 超时，主动重连", {
        heartbeatTotal: this.heartbeatTotal,
        heartbeatAckTotal: this.heartbeatAckTotal,
        sequence: this.seq,
      });
      this.reconnectNow();
      return;
    }

    this.awaitingHeartbeatAck = true;
    this.heartbeatTotal += 1;
    this.heartbeatRecent += 1;
    this.send({ op: OPCODE_HEARTBEAT, d: this.seq });
  }

  private readHeartbeatInterval(data: unknown): number {
    const interval = Number((data as Record<string, unknown> | undefined)?.heartbeat_interval);
    return Number.isFinite(interval) && interval > 0 ? interval : 45_000;
  }

  private send(payload: Record<string, unknown>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  private reconnectNow(): void {
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this.clearHeartbeat();
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.closedByUser || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, DEFAULT_RECONNECT_DELAY_MS);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.heartbeatSummaryTimer) clearInterval(this.heartbeatSummaryTimer);
    this.heartbeatTimer = null;
    this.heartbeatSummaryTimer = null;
    this.awaitingHeartbeatAck = false;
    this.heartbeatRecent = 0;
    this.heartbeatAckRecent = 0;
  }

  private clearReconnect(): void {
    if (!this.reconnectTimer) return;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private redactGatewayUrl(url: string): string {
    try {
      const parsed = new URL(url);
      parsed.search = parsed.search ? "?..." : "";
      return parsed.toString();
    } catch {
      return "[invalid gateway url]";
    }
  }
}

function pickOfficialReferenceFields(data: unknown): Record<string, unknown> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return {};
  const record = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const key of ["message_reference", "reference", "referenced_message", "reply", "src_msg_id"]) {
    if (record[key] !== undefined) result[key] = record[key];
  }

  return result;
}
