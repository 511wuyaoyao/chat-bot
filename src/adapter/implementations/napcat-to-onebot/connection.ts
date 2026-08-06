/**
 * NapCat WebSocket 连接保活。
 */

import { WebSocket } from "ws";

export interface WsPingLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export interface WsPingOptions {
  intervalSeconds: number;
  summaryMinutes: number;
  logger: WsPingLogger;
}

export class WsPing {
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private statusTimer: ReturnType<typeof setInterval> | null = null;
  private pingTotal = 0;
  private pongTotal = 0;
  private awaitingPong = false;

  constructor(private ws: WebSocket, private options: WsPingOptions) {}

  start(): void {
    const pingMs = this.options.intervalSeconds * 1000;
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
        this.options.logger.warn("WebSocket pong 超时，主动断开半开连接，等待 NapCat 重连", {
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
      this.options.logger.debug("WebSocket 心跳统计", {
        __terminalFoldKey: "napcat-ws-heartbeat-summary",
        pingTotal: this.pingTotal,
        pongTotal: this.pongTotal,
        pingRecent,
        pongRecent,
      });
      pingRecent = 0;
      pongRecent = 0;
    }, this.options.summaryMinutes * 60_000);
  }

  stop(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.statusTimer) clearInterval(this.statusTimer);
    this.pingTimer = null;
    this.statusTimer = null;
    this.awaitingPong = false;
  }
}
