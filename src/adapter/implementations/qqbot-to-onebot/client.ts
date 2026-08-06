/**
 * QQ 官方机器人 OpenAPI HTTP 客户端。
 */

import https from "https";
import type {
  QQBotAccessTokenResponse,
  QQBotClientOptions,
  QQBotGatewayBotResponse,
  QQBotSendMessageResponse,
} from "./types";

const DEFAULT_API_BASE_URL = "https://api.sgroup.qq.com";
const DEFAULT_API_TIMEOUT_MS = 30_000;
const TOKEN_REFRESH_SKEW_MS = 60_000;
const QQBOT_ERROR_REASONS: Record<string, string> = {
  "100007": "appid 无效",
  "22006": "消息类型与内容不匹配",
  "50059": "输入类型错误",
  "304004": "无权限使用 ARK 模板",
  "304061": "消息内容无效",
  "304062": "订阅按钮数量达到上限",
  "304064": "订阅消息未授权",
  "304080": "文件信息无效",
  "304103": "消息 ID 已过期，不能回复",
  "340067": "获取机器人信息失败",
  "40034004": "富媒体信息转存失败",
  "40034005": "回复消息 msg_id 已过期",
  "40034006": "消息内容违规",
  "40034008": "markdown 参数有空值",
  "40034009": "markdown 参数有换行符",
  "40034010": "模板参数中不能含有 markdown 语法",
  "40034011": "无效的 markdown 内容",
  "40034024": "请求参数 msg_id 无效或越权",
  "40034025": "请求参数 event_id 无效",
  "40034026": "请求参数 event_id 已过期",
  "40034027": "该事件不支持回复消息",
  "40034029": "内联键盘行/列超限",
  "40034100": "主动消息发送超过频控限制",
  "40034105": "主动消息发送失败，无权限",
  "40034106": "消息不支持该指令类型",
  "40034108": "指令参数长度超限",
  "40034109": "指令参数解析失败",
  "40034122": "召回消息已达区间上限",
  "40034123": "不支持召回消息",
  "40034124": "markdown 消息参数错误",
  "40034127": "无 markdown 模板权限",
  "40034128": "被动回复时间或次数超限",
  "40054004": "无好友关系",
  "40054005": "消息被去重",
  "40054006": "验证好友关系失败",
  "40054007": "消息长度超限",
  "40054013": "用户拒收消息",
  "40054016": "机器人已下线",
  "40054018": "消息过长或异常",
  "50055002": "消息发送异常，请稍后重试",
};

export class QQBotOfficialClient {
  private accessToken = "";
  private accessTokenExpiresAt = 0;
  private apiBaseUrl: string;

  constructor(private options: QQBotClientOptions) {
    this.apiBaseUrl = options.apiBaseUrl ?? DEFAULT_API_BASE_URL;
  }

  async sendC2CMessage(openid: string, content: string, referenceMessageId?: string): Promise<QQBotSendMessageResponse> {
    return this.postOpenApi(
      `/v2/users/${encodeURIComponent(openid)}/messages`,
      this.buildTextMessageBody(content, referenceMessageId)
    );
  }

  async sendGroupMessage(
    groupOpenid: string,
    content: string,
    referenceMessageId?: string
  ): Promise<QQBotSendMessageResponse> {
    return this.postOpenApi(
      `/v2/groups/${encodeURIComponent(groupOpenid)}/messages`,
      this.buildTextMessageBody(content, referenceMessageId)
    );
  }

  async deleteC2CMessage(openid: string, messageId: string): Promise<Record<string, unknown>> {
    return this.deleteOpenApi(`/v2/users/${encodeURIComponent(openid)}/messages/${encodeURIComponent(messageId)}`);
  }

  async deleteGroupMessage(groupOpenid: string, messageId: string): Promise<Record<string, unknown>> {
    return this.deleteOpenApi(
      `/v2/groups/${encodeURIComponent(groupOpenid)}/messages/${encodeURIComponent(messageId)}`
    );
  }

  async getGatewayBot(): Promise<QQBotGatewayBotResponse> {
    const token = await this.getAccessToken();
    return this.getJson<QQBotGatewayBotResponse>(`${this.apiBaseUrl}/gateway/bot`, {
      Authorization: `QQBot ${token}`,
      "X-Union-Appid": this.options.appId,
    });
  }

  async getGatewayIdentifyToken(): Promise<string> {
    return `QQBot ${await this.getAccessToken()}`;
  }

  private buildTextMessageBody(content: string, referenceMessageId?: string): Record<string, unknown> {
    return {
      content,
      msg_type: 0,
      ...(referenceMessageId ? { message_reference: { message_id: referenceMessageId } } : {}),
    };
  }

  private async postOpenApi<T>(path: string, body: unknown): Promise<T> {
    const token = await this.getAccessToken();
    return this.postJson<T>(`${this.apiBaseUrl}${path}`, body, {
      Authorization: `QQBot ${token}`,
      "X-Union-Appid": this.options.appId,
      "Content-Type": "application/json",
    });
  }

  private async deleteOpenApi<T>(path: string): Promise<T> {
    const token = await this.getAccessToken();
    return this.deleteJson<T>(`${this.apiBaseUrl}${path}`, {
      Authorization: `QQBot ${token}`,
      "X-Union-Appid": this.options.appId,
    });
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.accessTokenExpiresAt - TOKEN_REFRESH_SKEW_MS) {
      return this.accessToken;
    }

    const response = await this.postJson<QQBotAccessTokenResponse>(
      "https://bots.qq.com/app/getAppAccessToken",
      {
        appId: this.options.appId,
        clientSecret: this.options.appSecret,
      },
      { "Content-Type": "application/json" }
    );

    const accessToken = response.access_token ?? response.accessToken;
    if (!accessToken) {
      throw new Error(`QQ official bot auth response missing access_token: ${this.safeTokenResponseSummary(response)}`);
    }

    const expiresInSeconds = Number(response.expires_in ?? response.expiresIn ?? 7200);
    this.accessToken = accessToken;
    this.accessTokenExpiresAt = Date.now() + expiresInSeconds * 1000;
    this.options.logger.debug("QQ official bot access_token refreshed", { expires_in: expiresInSeconds });
    return this.accessToken;
  }

  private safeTokenResponseSummary(response: QQBotAccessTokenResponse): string {
    return JSON.stringify({
      code: response.code,
      err_code: response.err_code,
      message: response.message,
      trace_id: response.trace_id,
      keys: Object.keys(response).filter((key) => !/token|secret/i.test(key)),
    });
  }

  private getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const urlObj = new URL(url);
      const requestLabel = `GET ${this.redactUrl(urlObj)}`;
      const req = https.request(
        {
          hostname: urlObj.hostname,
          path: `${urlObj.pathname}${urlObj.search}`,
          method: "GET",
          headers,
          agent: false,
        },
        (res) => {
          let responseBody = "";
          res.on("data", (chunk) => (responseBody += chunk));
          res.on("end", () => {
            clearTimeout(timeoutTimer);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(this.formatHttpError(res.statusCode, requestLabel, responseBody, startedAt)));
              return;
            }

            try {
              resolve(responseBody ? JSON.parse(responseBody) as T : ({} as T));
            } catch (err) {
              reject(err);
            }
          });
          res.on("error", (err) => {
            clearTimeout(timeoutTimer);
            reject(this.wrapRequestError(err, requestLabel, startedAt, timeoutMs));
          });
        }
      );

      const timeoutMs = this.apiTimeoutMs();
      const timeoutTimer = setTimeout(() => {
        req.destroy(new Error(this.formatTimeoutError(requestLabel, startedAt, timeoutMs)));
      }, timeoutMs);
      req.on("error", (err) => {
        clearTimeout(timeoutTimer);
        reject(this.wrapRequestError(err, requestLabel, startedAt, timeoutMs));
      });
      req.end();
    });
  }

  private postJson<T>(url: string, body: unknown, headers: Record<string, string>): Promise<T> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const data = JSON.stringify(body);
      const urlObj = new URL(url);
      const requestLabel = `POST ${this.redactUrl(urlObj)}`;
      const req = https.request(
        {
          hostname: urlObj.hostname,
          path: `${urlObj.pathname}${urlObj.search}`,
          method: "POST",
          headers: {
            ...headers,
            "Content-Length": String(Buffer.byteLength(data)),
          },
          agent: false,
        },
        (res) => {
          let responseBody = "";
          res.on("data", (chunk) => (responseBody += chunk));
          res.on("end", () => {
            clearTimeout(timeoutTimer);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(this.formatHttpError(res.statusCode, requestLabel, responseBody, startedAt)));
              return;
            }

            try {
              resolve(responseBody ? JSON.parse(responseBody) as T : ({} as T));
            } catch (err) {
              reject(err);
            }
          });
          res.on("error", (err) => {
            clearTimeout(timeoutTimer);
            reject(this.wrapRequestError(err, requestLabel, startedAt, timeoutMs));
          });
        }
      );

      const timeoutMs = this.apiTimeoutMs();
      const timeoutTimer = setTimeout(() => {
        req.destroy(new Error(this.formatTimeoutError(requestLabel, startedAt, timeoutMs)));
      }, timeoutMs);
      req.on("error", (err) => {
        clearTimeout(timeoutTimer);
        reject(this.wrapRequestError(err, requestLabel, startedAt, timeoutMs));
      });
      req.write(data);
      req.end();
    });
  }

  private deleteJson<T>(url: string, headers: Record<string, string>): Promise<T> {
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const urlObj = new URL(url);
      const requestLabel = `DELETE ${this.redactUrl(urlObj)}`;
      const req = https.request(
        {
          hostname: urlObj.hostname,
          path: `${urlObj.pathname}${urlObj.search}`,
          method: "DELETE",
          headers,
          agent: false,
        },
        (res) => {
          let responseBody = "";
          res.on("data", (chunk) => (responseBody += chunk));
          res.on("end", () => {
            clearTimeout(timeoutTimer);
            if (res.statusCode && res.statusCode >= 400) {
              reject(new Error(this.formatHttpError(res.statusCode, requestLabel, responseBody, startedAt)));
              return;
            }

            try {
              resolve(responseBody ? JSON.parse(responseBody) as T : ({} as T));
            } catch (err) {
              reject(err);
            }
          });
          res.on("error", (err) => {
            clearTimeout(timeoutTimer);
            reject(this.wrapRequestError(err, requestLabel, startedAt, timeoutMs));
          });
        }
      );

      const timeoutMs = this.apiTimeoutMs();
      const timeoutTimer = setTimeout(() => {
        req.destroy(new Error(this.formatTimeoutError(requestLabel, startedAt, timeoutMs)));
      }, timeoutMs);
      req.on("error", (err) => {
        clearTimeout(timeoutTimer);
        reject(this.wrapRequestError(err, requestLabel, startedAt, timeoutMs));
      });
      req.end();
    });
  }

  private apiTimeoutMs(): number {
    const value = Number(this.options.apiTimeoutMs);
    return Number.isFinite(value) && value > 0 ? value : DEFAULT_API_TIMEOUT_MS;
  }

  private formatTimeoutError(requestLabel: string, startedAt: number, timeoutMs: number): string {
    const elapsedMs = Date.now() - startedAt;
    return `QQBot API request timeout: elapsed=${elapsedMs}ms timeout=${timeoutMs}ms ${requestLabel}`;
  }

  private formatHttpError(statusCode: number, requestLabel: string, responseBody: string, startedAt: number): string {
    const elapsedMs = Date.now() - startedAt;
    const detail = this.parseErrorDetail(responseBody);
    return [
      `QQBot API HTTP ${statusCode}:`,
      `elapsed=${elapsedMs}ms`,
      detail.code ? `code=${detail.code}` : "",
      detail.reason ? `reason=${detail.reason}` : "",
      detail.message ? `message=${detail.message}` : "",
      detail.traceId ? `trace_id=${detail.traceId}` : "",
      requestLabel,
      responseBody ? `body=${responseBody.substring(0, 300)}` : "",
    ].filter(Boolean).join(" ");
  }

  private wrapRequestError(err: Error, requestLabel: string, startedAt: number, timeoutMs: number): Error {
    if (err.message.startsWith("QQBot API request timeout:")) return err;
    const elapsedMs = Date.now() - startedAt;
    const code = (err as NodeJS.ErrnoException).code;
    return new Error([
      "QQBot API request failed:",
      `elapsed=${elapsedMs}ms`,
      `timeout=${timeoutMs}ms`,
      code ? `error_code=${code}` : "",
      requestLabel,
      `error=${err.message}`,
    ].filter(Boolean).join(" "));
  }

  private parseErrorDetail(responseBody: string): {
    code?: string;
    reason?: string;
    message?: string;
    traceId?: string;
  } {
    try {
      const parsed = JSON.parse(responseBody) as Record<string, unknown>;
      const codeValue = parsed.err_code ?? parsed.code;
      const code = typeof codeValue === "string" || typeof codeValue === "number" ? String(codeValue) : undefined;
      const message = typeof parsed.message === "string" ? parsed.message : undefined;
      const traceId = typeof parsed.trace_id === "string" ? parsed.trace_id : undefined;
      return {
        code,
        reason: code ? QQBOT_ERROR_REASONS[code] : undefined,
        message,
        traceId,
      };
    } catch {
      return {};
    }
  }

  private redactUrl(url: URL): string {
    return `${url.origin}${url.pathname}`;
  }
}
