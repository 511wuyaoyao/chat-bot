/**
 * 连接保活 — WS ping + 消息心跳，统一管理
 * WsPing: 管理 NapCat WebSocket 的 ping/pong 保活
 * MsgHeartbeat: 定时给自己发消息，防 NapCat↔QQ 空闲断连
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

  constructor(private ws: WebSocket) {}

  start(): void {
    const pingMs = config.qq.wsPingIntervalSeconds * 1000;
    let pingRecent = 0;
    let pongRecent = 0;

    this.pingTimer = setInterval(() => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.pingTotal++;
        pingRecent++;
        this.ws.ping();
      }
    }, pingMs);

    this.statusTimer = setInterval(() => {
      const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
      process.stdout.write(
        `\r\x1b[K\x1b[90m[WS] ping ${this.pingTotal} / pong ${this.pongTotal}  最近5s ping ${pingRecent} / pong ${pongRecent}  ${now}\x1b[0m`
      );
      pingRecent = 0;
      pongRecent = 0;
    }, 5000);

    this.ws.on("pong", () => {
      this.pongTotal++;
      pongRecent++;
    });
  }

  stop(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.statusTimer) clearInterval(this.statusTimer);
  }
}

// ====== 消息心跳 ======

const HB_MSG = "​"; // 零宽空格

export class MsgHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;
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
      logger.info("消息心跳已禁用（heartbeatMinutes ≤ 0）");
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
    try {
      await this.adapter.sendMessage("private", this.selfId, HB_MSG);
      if (this.consecutiveFailures > 0) {
        logger.info(`心跳恢复，此前连续失败 ${this.consecutiveFailures} 次`);
      }
      this.consecutiveFailures = 0;
    } catch {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.failThreshold) {
        logger.warn(`!!! 心跳连续失败 ${this.consecutiveFailures} 次 !!! — NapCat HTTP API 可能不可达`);
      }
    }
  }
}
