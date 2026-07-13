/**
 * 基于 NapCat HTTP 与反向 WebSocket 的 OneBot11 适配器实现。
 */

import express, { Request, Response } from "express";
import http from "http";
import { WebSocket, WebSocketServer } from "ws";
import type {
  OneBot11AdapterOptions,
  OneBot11Runtime,
  OneBotApiResponse,
  OneBotDeleteMsgRequest,
  OneBotGetMsgData,
  OneBotGetMsgRequest,
  OneBotSendGroupMsgRequest,
  OneBotSendMsgData,
  OneBotSendMsgRequest,
  OneBotSendPrivateMsgRequest,
} from "../../protocol/onebot11";
import { WsPing } from "./connection";
import { napcatRawEventToOneBot11 } from "./to-onebot11";

class NapCatBackedOneBot11Adapter implements OneBot11Runtime {
  private app = express();
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;
  private currentWs: WebSocket | null = null;

  constructor(private options: OneBot11AdapterOptions) {
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
        this.options.logger.warn("收到新的 NapCat WebSocket 连接，关闭旧连接");
        this.currentWs.close(1000, "new connection replaced old one");
      }

      this.currentWs = ws;
      napcatConnected = true;
      this.options.logger.info("NapCat WebSocket 已连接");

      const wsPing = new WsPing(ws, {
        intervalSeconds: this.options.wsPingIntervalSeconds,
        summaryMinutes: this.options.wsPingSummaryMinutes,
        logger: this.options.logger,
      });
      wsPing.start();

      ws.on("message", async (data) => {
        const raw = data.toString();
        try {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          this.logIncomingEvent(parsed);

          const event = napcatRawEventToOneBot11(parsed);
          if (event) await this.options.onEvent(event);
        } catch (err) {
          this.options.logger.warn("收到无法解析的 NapCat WebSocket 消息", {
            raw_length: raw.length,
            error: String(err),
          });
        }
      });

      ws.on("close", (code, reason) => {
        wsPing.stop();
        if (this.currentWs === ws) {
          this.currentWs = null;
          napcatConnected = false;
        }
        this.options.logger.warn("NapCat WebSocket 断开，等待 NapCat 自动重连", {
          code,
          reason: reason.toString(),
        });
      });

      ws.on("error", (err) => {
        this.options.logger.error("WebSocket 错误", { error: err.message });
      });
    });

    this.server.listen(this.options.port, () => {
      this.options.logger.info(`OneBot11 适配器已启动，监听端口 ${this.options.port}`);
      this.options.logger.info(`等待 OneBot11 反向 WS 连接: ws://127.0.0.1:${this.options.port}/ws`);

      setTimeout(() => {
        if (!napcatConnected) {
          this.options.logger.warn("OneBot11 反向 WS 未连接：启动 10 秒后仍未收到连接");
          this.options.logger.warn("请检查 NapCatQQ 是否已启动，以及 WebSocket 客户端地址是否正确");
        }
      }, 10_000);
    });
  }

  async sendPrivateMsg(request: OneBotSendPrivateMsgRequest): Promise<OneBotSendMsgData | null> {
    try {
      return await this.postSendAction("send_private_msg", request);
    } catch (err) {
      this.logSendError("发送私聊消息失败", err, { user_id: request.user_id });
      return null;
    }
  }

  async sendGroupMsg(request: OneBotSendGroupMsgRequest): Promise<OneBotSendMsgData | null> {
    try {
      return await this.postSendAction("send_group_msg", request);
    } catch (err) {
      this.logSendError("发送群消息失败", err, { group_id: request.group_id });
      return null;
    }
  }

  async sendMsg(request: OneBotSendMsgRequest): Promise<OneBotSendMsgData | null> {
    try {
      return await this.postSendAction("send_msg", request);
    } catch (err) {
      this.logSendError("发送消息失败", err, {
        message_type: request.message_type,
        user_id: request.user_id,
        group_id: request.group_id,
      });
      return null;
    }
  }

  async deleteMsg(request: OneBotDeleteMsgRequest): Promise<boolean> {
    try {
      const response = await this.httpPost(`${this.options.baseUrl}/delete_msg`, request);
      const parsed = JSON.parse(response) as OneBotApiResponse;
      const ok = this.isOkResponse(parsed);
      this.options.logger.debug(ok ? `消息已撤回 ${request.message_id}` : `撤回失败: ${request.message_id}`, {
        response: response.substring(0, 100),
      });
      return ok;
    } catch (err) {
      this.options.logger.error("撤回消息失败", { error: String(err), message_id: request.message_id });
      return false;
    }
  }

  async getMsg(request: OneBotGetMsgRequest): Promise<OneBotGetMsgData | null> {
    try {
      const response = await this.httpPost(`${this.options.baseUrl}/get_msg`, request);
      const parsed = JSON.parse(response) as OneBotApiResponse<OneBotGetMsgData>;
      return parsed.data ?? null;
    } catch (err) {
      this.options.logger.warn("读取消息失败", { message_id: request.message_id, error: String(err) });
      return null;
    }
  }

  stop(): void {
    if (this.wss) this.wss.close();
    if (this.server) this.server.close();
  }

  private logIncomingEvent(event: Record<string, unknown>): void {
    const summary = this.buildEventLogSummary(event);

    if (this.options.rawEventLogEnabled) {
      this.options.logger.debug("NapCat 原始事件", {
        ...summary,
        raw_keys: Object.keys(event),
        raw_preview: this.safeJsonPreview(event, 500),
      });
    }

    if (event.post_type !== "notice") return;
    const noticeType = String(event.notice_type ?? "");
    const isRecall = noticeType === "friend_recall" || noticeType === "group_recall";
    const meta = {
      ...summary,
      recalled_message_id: isRecall ? summary.message_id : undefined,
    };

    if (isRecall) {
      this.options.logger.info("NapCat 撤回通知", meta);
      return;
    }

  }

  private buildEventLogSummary(event: Record<string, unknown>): Record<string, unknown> {
    return {
      post_type: event.post_type,
      notice_type: event.notice_type,
      message_type: event.message_type,
      sub_type: event.sub_type,
      user_id: event.user_id,
      group_id: event.group_id,
      operator_id: event.operator_id,
      target_id: event.target_id,
      message_id: event.message_id ?? event.msg_id ?? event.msg_seq ?? event.message_seq ?? event.seq,
      self_id: event.self_id,
      time: event.time,
    };
  }

  private safeJsonPreview(value: unknown, maxLength: number): string {
    try {
      return JSON.stringify(value).slice(0, maxLength);
    } catch {
      return "[unserializable]";
    }
  }

  private async postSendAction(
    action: "send_private_msg" | "send_group_msg" | "send_msg",
    request: OneBotSendPrivateMsgRequest | OneBotSendGroupMsgRequest | OneBotSendMsgRequest
  ): Promise<OneBotSendMsgData> {
    const response = await this.httpPost(`${this.options.baseUrl}/${action}`, request);
    const parsed = JSON.parse(response) as OneBotApiResponse<OneBotSendMsgData>;
    if (!this.isOkResponse(parsed)) {
      throw new Error(`OneBot11 API 返回失败：${response.substring(0, 300)}`);
    }

    const messageId = parsed.data?.message_id ?? null;
    if (!messageId) {
      throw new Error(`OneBot11 API 未返回 message_id：${response.substring(0, 300)}`);
    }
    return { message_id: messageId };
  }

  private isOkResponse(response: OneBotApiResponse): boolean {
    return response.status === "ok" || response.retcode === 0;
  }

  private logSendError(message: string, err: unknown, context: Record<string, unknown>): void {
    const reason = (err as NodeJS.ErrnoException).code === "ECONNREFUSED"
      ? `OneBot11 HTTP API 不可达 (${this.options.baseUrl})，请确认实现端已启动且 HTTP 服务端口正确`
      : `${message}：${String(err)}`;
    this.options.logger.error(reason, context);
  }

  private httpPost(url: string, body: unknown): Promise<string> {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const urlObj = new URL(url);
      let path = urlObj.pathname;
      if (this.options.accessToken) path += `?access_token=${this.options.accessToken}`;

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
        req.destroy(new Error("OneBot11 HTTP API 请求超时"));
      });
      req.on("error", reject);
      req.write(data);
      req.end();
    });
  }
}

export function createOneBot11Adapter(options: OneBot11AdapterOptions): OneBot11Runtime {
  return new NapCatBackedOneBot11Adapter(options);
}
