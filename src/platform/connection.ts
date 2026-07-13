/**
 * 平台消息心跳。
 */

import { config } from "../config";
import { logger } from "../utils/logger";
import type { Platform } from "./platform";

const HB_MSG = "\u200b";

export class MsgHeartbeat {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private consecutiveFailures = 0;
  private readonly intervalMs: number;
  private readonly failThreshold: number;

  constructor(private platform: Platform) {
    this.intervalMs = config.qq.heartbeatMinutes * 60_000;
    this.failThreshold = config.qq.heartbeatFailThreshold;
  }

  start(): void {
    if (this.timer) return;
    if (this.intervalMs <= 0) {
      logger.info("消息心跳已禁用（heartbeatMinutes <= 0）");
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
      logger.warn("上一轮消息心跳仍未完成，本轮跳过");
      return;
    }

    this.running = true;
    try {
      const selfId = this.platform.getSelfId();
      if (!selfId) {
        logger.warn("尚未收到平台 self_id，本轮消息心跳跳过");
        return;
      }
      const messageId = await this.platform.sendMessage("private", selfId, HB_MSG);
      if (!messageId) throw new Error("发送接口未返回有效 message_id");

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
        logger.warn(`!!! 心跳连续失败 ${this.consecutiveFailures} 次，消息发送链路可能不可用`);
      }
    } finally {
      this.running = false;
    }
  }
}
