/**
 * QQ 平台适配器
 * 基于 Express + WebSocket 接收 NapCat 事件推送，通过 HTTP API 发送消息
 */

import express, { Request, Response } from "express";
import http from "http";
import { WebSocket, WebSocketServer } from "ws";
import { config } from "../config";
import { logger } from "../utils/logger";
import { WsPing } from "./connection";

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
  /** 引用回复的消息（OneBot v11 reply 字段），用户引用某条消息时存在 */
  reply?: {
    message_id: number;
    user_id: number;
    raw_message: string;
  } | null;
}

export interface QqAdapterOptions {
  onMessage: (msg: QqMessage) => Promise<string | null>;
  /** 用户撤回消息时回调，传入 user_id 和 被撤回的 message_id */
  onRecall?: (userId: string, messageId: number) => void;
}

const napcatUrl = process.env.NAPCAT_BASE_URL || "http://127.0.0.1:3000";

interface OneBotApiResponse {
  status?: string;
  retcode?: number;
  message?: string;
  wording?: string;
  data?: {
    message_id?: number;
  } | null;
}

export class QqAdapter {
  private app = express();
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private currentWs: WebSocket | null = null;

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

      // 保活 ping
      const wsPing = new WsPing(ws);
      wsPing.start();

      ws.on("message", async (data) => {
        const raw = data.toString();
        try {
          const event = JSON.parse(raw);
          await this.handleEvent(event);
        } catch {
          // 非 JSON 消息忽略
        }
      });

      ws.on("close", (code, reason) => {
        wsPing.stop();
        if (this.currentWs === ws) {
          this.currentWs = null;
          napcatConnected = false;
        }
        logger.warn("!!! NapCat WebSocket 断开 !!! — QQ 消息接收已中断，等待 NapCat 自动重连", {
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
    // 撤回事件
    if (event.post_type === "notice") {
      const noticeType = event.notice_type as string;
      if (noticeType === "friend_recall" || noticeType === "group_recall") {
        const messageId = event.message_id as number;
        const uid = String(event.user_id ?? "");
        if (messageId) {
          logger.debug(`用户撤回消息`, { user_id: uid, message_id: messageId });
          this.options.onRecall?.(uid, messageId);
        }
      }
      return;
    }

    if (event.post_type !== "message") return;

    // 过滤掉 Bot 自己发的 / API 响应等
    if (event.message_type !== "private" && event.message_type !== "group") return;

    // 规范化 reply 字段：OneBot v11 的 reply.sender.user_id → reply.user_id
    const rawReply = event.reply as Record<string, unknown> | undefined;
    const normalizedReply = rawReply
      ? {
          message_id: rawReply.message_id as number,
          user_id: (rawReply.sender as Record<string, unknown>)?.user_id as number,
          raw_message: rawReply.raw_message as string,
        }
      : null;

    const msg: QqMessage = { ...(event as unknown as QqMessage), reply: normalizedReply };
    const userId = String(msg.user_id);

    if (!config.qq.whitelist.includes(userId)) {
      logger.debug(`忽略非白名单用户: ${userId}`);
      return;
    }

    if (!msg.raw_message?.trim()) return;

    logger.info(`收到消息`, {
      user_id: userId,
      message_id: msg.message_id,
      text: msg.raw_message?.substring(0, 50),
      ...(msg.reply ? { reply_to: msg.reply.message_id, reply_user: msg.reply.user_id } : {}),
    });

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
      const parsed = JSON.parse(response) as OneBotApiResponse;
      const ok = parsed.status === "ok" || parsed.retcode === 0;
      if (!ok) {
        throw new Error(`NapCat API 返回失败：${response.substring(0, 300)}`);
      }

      const messageId = parsed.data?.message_id || null;
      if (!messageId) {
        throw new Error(`NapCat API 未返回 message_id：${response.substring(0, 300)}`);
      }

      logger.info(`消息已发送`, { type, user_id: userId, message_id: messageId });
      return messageId;
    } catch (err) {
      const reason = (err as NodeJS.ErrnoException).code === "ECONNREFUSED"
        ? `NapCat HTTP API 不可达 (${napcatUrl})，请确认 NapCatQQ 已启动且 HTTP 服务端口正确`
        : `发送消息失败：${String(err)}`;
      logger.error(reason, { type, user_id: userId });
      return null;
    }
  }

  /** 撤回消息 */
  async recallMessage(messageId: number): Promise<boolean> {
    try {
      const response = await this.httpPost(`${napcatUrl}/delete_msg`, {
        message_id: messageId,
      });
      const parsed = JSON.parse(response) as OneBotApiResponse;
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
        res.on("end", () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${body.substring(0, 300)}`));
            return;
          }
          resolve(body);
        });
      });
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
