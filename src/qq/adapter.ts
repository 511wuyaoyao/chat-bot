/**
 * QQ 平台适配器
 * 基于 Express + WebSocket 接收 NapCat 事件推送，通过 HTTP API 发送消息
 */

import express, { Request, Response } from "express";
import http from "http";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { config } from "../config";
import { logger } from "../utils/logger";
import { routeMessage } from "../router/message-router";

/** OneBot v11 消息事件 */
export interface QqMessage {
  message_id: number;
  user_id: number;
  group_id?: number;
  message_type: "private" | "group";
  raw_message: string;
  sender: {
    nickname: string;
  };
}

export interface QqAdapterOptions {
  onMessage: (msg: QqMessage) => Promise<string | null>;
}

const napcatUrl = process.env.NAPCAT_BASE_URL || "http://127.0.0.1:3000";

export class QqAdapter {
  private app = express();
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;

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
      napcatConnected = true;
      logger.info("NapCat WebSocket 已连接");

      // 保活 ping + 动态状态行（每 5 秒原地刷新）
      const pingMs = config.qq.wsPingIntervalSeconds * 1000;
      let pingTotal = 0;
      let pongTotal = 0;
      let pingRecent = 0;
      let pongRecent = 0;

      const pingTimer = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          pingTotal++;
          pingRecent++;
          ws.ping();
        }
      }, pingMs);

      const statusTimer = setInterval(() => {
        const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });
        process.stdout.write(`\r\x1b[K\x1b[90m[WS] 累计 ping ${pingTotal} / pong ${pongTotal}  最近 5 秒 ping ${pingRecent} / pong ${pongRecent}  ${now}\x1b[0m`);
        pingRecent = 0;
        pongRecent = 0;
      }, 5000);

      ws.on("pong", () => {
        pongTotal++;
        pongRecent++;
      });

      ws.on("message", async (data) => {
        const raw = data.toString();
        try {
          const event = JSON.parse(raw);
          await this.handleEvent(event);
        } catch {
          // 非 JSON 消息忽略
        }
      });

      ws.on("close", () => {
        clearInterval(pingTimer);
        clearInterval(statusTimer);
        napcatConnected = false;
        logger.warn("!!! NapCat WebSocket 断开 !!! — QQ 消息收发已中断，请检查 NapCatQQ 是否仍在运行");
      });

      ws.on("error", (err) => {
        clearInterval(pingTimer);
        clearInterval(statusTimer);
        logger.error("WebSocket 错误", { error: err.message });
      });
    });

    this.server.listen(config.qq.port, () => {
      logger.info(`QQ 适配器已启动，监听端口 ${config.qq.port}`);
      logger.info(`等待 NapCat 反向 WS 连接: ws://127.0.0.1:${config.qq.port}/ws`);

      // 10 秒后仍未连接 → 警告
      setTimeout(() => {
        if (!napcatConnected) {
          logger.warn("!!! NapCat 未连接 !!! — 启动 10 秒后仍未收到 NapCat WebSocket 连接");
          logger.warn("请检查：1) NapCatQQ 是否已启动  2) NapCat 网络配置中 WebSocket 客户端地址是否正确");
        }
      }, 10_000);
    });
  }

  private async handleEvent(event: Record<string, unknown>) {
    if (event.post_type !== "message") return;

    // 过滤掉 Bot 自己发的 / API 响应等
    if (event.message_type !== "private" && event.message_type !== "group") return;

    const msg = event as unknown as QqMessage;
    const userId = String(msg.user_id);

    if (!config.qq.whitelist.includes(userId)) {
      logger.debug(`忽略非白名单用户: ${userId}`);
      return;
    }

    if (!msg.raw_message?.trim()) return;

    logger.info(`收到消息`, { user_id: userId, message_id: msg.message_id, text: msg.raw_message?.substring(0, 50) });

    try {
      const reply = await this.options.onMessage(msg);
      logger.info(`回复内容`, { reply, msg_type: msg.message_type, user_id: userId });
      if (reply) {
        await this.sendMessage(msg.message_type, userId, reply, msg.group_id);
      } else {
        logger.warn("未生成回复");
      }
    } catch (err) {
      logger.error("消息处理异常", { error: String(err) });
    }
  }

  /** 发送消息，返回 message_id（用于后续撤回） */
  async sendMessage(
    type: "private" | "group",
    userId: string,
    message: string,
    groupId?: number
  ): Promise<number | null> {
    try {
      let response: string;
      if (type === "private") {
        response = await this.httpPost(`${napcatUrl}/send_private_msg`, {
          user_id: Number(userId),
          message,
        });
      } else if (type === "group" && groupId) {
        response = await this.httpPost(`${napcatUrl}/send_group_msg`, {
          group_id: groupId,
          message,
        });
      } else {
        return null;
      }
      const parsed = JSON.parse(response);
      const messageId = parsed.data?.message_id || null;
      logger.info(`消息已发送`, { type, user_id: userId, message_id: messageId });
      return messageId;
    } catch (err) {
      const reason = (err as NodeJS.ErrnoException).code === "ECONNREFUSED"
        ? `NapCat HTTP API 不可达 (${napcatUrl})，请确认 NapCatQQ 已启动且 HTTP 服务端口正确`
        : `发送消息失败：${String(err)}`;
      logger.error(reason);
      return null;
    }
  }

  /** 撤回消息 */
  async recallMessage(messageId: number): Promise<boolean> {
    try {
      const response = await this.httpPost(`${napcatUrl}/delete_msg`, {
        message_id: messageId,
      });
      const parsed = JSON.parse(response);
      const ok = parsed.status === "ok" || parsed.retcode === 0;
      logger.debug(ok ? `消息已撤回: ${messageId}` : `撤回失败: ${messageId}`, { response: response.substring(0, 100) });
      return ok;
    } catch (err) {
      logger.error("撤回消息失败", { error: String(err), message_id: messageId });
      return false;
    }
  }

  private httpPost(url: string, body: unknown): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const urlObj = new URL(url);
      let path = urlObj.pathname;
      if (config.qq.napcatToken) {
        path += `?access_token=${config.qq.napcatToken}`;
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(data)),
      };
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path,
        method: "POST",
        headers,
      };

      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve(body));
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
