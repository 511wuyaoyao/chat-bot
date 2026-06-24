/**
 * 连接保活：WebSocket ping/pong 与消息层心跳。
 * WsPing 负责发现半开连接并主动断开，MsgHeartbeat 负责发现 NapCat HTTP/API 异常。
 */

import { WebSocket } from "ws";
import { config } from "../config";
import { logger } from "../utils/logger";
import type { QqAdapter } from "./adapter";

// ====== WS Ping ======

export class WsPing {
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private pingTotal = 0;
  private pongTotal = 0;
  private awaitingPong = false;

  constructor(private ws: WebSocket) {}

  start(): void {
    const pingMs = config.qq.wsPingIntervalSeconds * 1000;
    let pingRecent = 0;
    let pongRecent = 0;

    this.ws.on("pong", () => {
      this.awaitingPong = false;
      this.pongTotal++;
      pongRecent++;
    });

    this.pingTimer = setInterval(() => {
      if (this.ws.readyState !== WebSocket.OPEN) return;

      if (this.awaitingPong) {
        logger.warn("WebSocket pong 超时，主动断开半开连接，等待 NapCat 重连", {
          pingTotal: this.pingTotal,
          pongTotal: this.pongTotal,
        });
        this.ws.terminate();
        return;
      }

      this.awaitingPong = true;
      this.pingTotal++;
      pingRecent++;
      this.ws.ping();
    }, pingMs);

    this.statusTimer = setInterval(() => {
      logger.debug("WebSocket 心跳统计", {
        pingTotal: this.pingTotal,
        pongTotal: this.pongTotal,
        pingRecent,
        pongRecent,
      });
      pingRecent = 0;
      pongRecent = 0;
    }, config.qq.wsPingSummaryMinutes * 60_000);
  }

  stop(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.pingTimer = null;
    this.statusTimer = null;
    this.awaitingPong = false;
  }
}

// ====== 消息心跳 ======

const HB_MSG = "\u200b"; // 零宽空格

export class MsgHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private consecutiveFailures = 0;
  private readonly intervalMs: number;
  private readonly selfId: string;
  private readonly failThreshold: number;

  constructor(private adapter: QqAdapter) {
    this.intervalMs = config.qq.heartbeatMinutes * 60_000;
    this.selfId = config.qq.selfId;
    this.failThreshold = config.qq.heartbeatFailThreshold;
  }

  start(): void {
    if (this.timer) return;
    if (this.intervalMs <= 0) {
      logger.info("消息心跳已禁用（heartbeatMinutes <= 0）");
      return;
    }
    if (!this.selfId) {
      logger.warn("未配置 QQ_SELF_ID，消息心跳未启用");
      return;
    }
    this.timer = setInterval(() => this.beat(), this.intervalMs);
    logger.info(`消息心跳已启用，间隔 ${config.qq.heartbeatMinutes} 分钟，连续失败阈值 ${this.failThreshold}`);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async beat(): Promise<void> {
    if (this.running) {
      logger.warn("上一次消息心跳仍未完成，本轮跳过");
      return;
    }

    this.running = true;
    try {
      const messageId = await this.adapter.sendMessage("private", this.selfId, HB_MSG);
      if (!messageId) {
        throw new Error("NapCat 未返回有效 message_id");
      }

      if (this.consecutiveFailures > 0) {
        logger.info(`消息心跳恢复，此前连续失败 ${this.consecutiveFailures} 次`);
      }
      this.consecutiveFailures = 0;
    } catch (err) {
      this.consecutiveFailures++;
      logger.warn("消息心跳失败", {
        consecutiveFailures: this.consecutiveFailures,
        error: String(err),
      });
      if (this.consecutiveFailures >= this.failThreshold) {
        logger.warn(`!!! 心跳连续失败 ${this.consecutiveFailures} 次 !!! NapCat HTTP API 或 QQ 连接可能不可用`);
      }
    } finally {
      this.running = false;
    }
  }
}
