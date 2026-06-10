/**
 * 心跳保活模块
 * 定时给自己发消息，防止 NapCat↔QQ 空闲断连
 * 连续失败超阈值时发出告警
 */

import { config } from "../config";
import { logger } from "../utils/logger";
import type { QqAdapter } from "./adapter";

/** 零宽空格，不可见消息 */
const HB_MSG = "​";

export class HeartbeatManager {
  private timer: ReturnType<typeof setInterval> | null = null;
  private consecutiveFailures = 0;
  private readonly adapter: QqAdapter;
  private readonly intervalMs: number;
  private readonly selfId: string;
  private readonly failThreshold: number;

  constructor(adapter: QqAdapter) {
    this.adapter = adapter;
    this.intervalMs = config.qq.heartbeatMinutes * 60_000;
    this.selfId = config.qq.selfId;
    this.failThreshold = config.qq.heartbeatFailThreshold;
  }

  /** 启动心跳定时器 */
  start(): void {
    if (this.timer) return;

    if (this.intervalMs <= 0) {
      logger.info("心跳保活已禁用（heartbeatMinutes ≤ 0）");
      return;
    }
    if (!this.selfId) {
      logger.warn("未配置 QQ_SELF_ID，心跳保活未启用");
      return;
    }

    this.timer = setInterval(() => this.beat(), this.intervalMs);
    logger.info(`心跳保活已启用，间隔 ${config.qq.heartbeatMinutes} 分钟，连续失败阈值 ${this.failThreshold}`);
  }

  /** 停止心跳定时器 */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info("心跳保活已停止");
    }
  }

  /** 手动触发一次心跳（供健康检查调用） */
  async beat(): Promise<boolean> {
    try {
      await this.adapter.sendMessage("private", this.selfId, HB_MSG);
      logger.debug("心跳已发送");

      if (this.consecutiveFailures > 0) {
        logger.info(`心跳恢复，此前连续失败 ${this.consecutiveFailures} 次`);
      }
      this.consecutiveFailures = 0;
      return true;
    } catch {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.failThreshold) {
        logger.warn(
          `!!! 心跳连续失败 ${this.consecutiveFailures} 次 !!! — NapCat HTTP API 可能不可达，QQ 消息收发可能已中断`
        );
      } else {
        logger.debug(`心跳失败 (${this.consecutiveFailures}/${this.failThreshold})`);
      }
      return false;
    }
  }

  /** 当前连续失败次数 */
  get failures(): number {
    return this.consecutiveFailures;
  }
}
