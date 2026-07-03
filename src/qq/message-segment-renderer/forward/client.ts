/**
 * 合并转发消息读取客户端
 * 封装 NapCat get_forward_msg HTTP API，供 forward 消息段渲染器读取聊天记录。
 */

import http from "http";
import { config } from "../../../config";
import { ForwardMessageApiResponse, ForwardedMessage } from "./types";

const napcatUrl = process.env.NAPCAT_BASE_URL || "http://127.0.0.1:3000";

export async function fetchForwardMessages(id: string): Promise<ForwardedMessage[] | null> {
  const response = await httpPost(`${napcatUrl}/get_forward_msg`, { id });
  const parsed = JSON.parse(response) as ForwardMessageApiResponse;
  const ok = parsed.status === "ok" || parsed.retcode === 0;
  if (!ok) return null;

  if (Array.isArray(parsed.data)) return parsed.data;
  if (!parsed.data || typeof parsed.data !== "object") return [];
  if (Array.isArray(parsed.data.messages)) return parsed.data.messages;
  if (Array.isArray(parsed.data.content)) return parsed.data.content;
  return [];
}

function httpPost(url: string, body: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    let path = urlObj.pathname;
    if (config.qq.napcatToken) {
      path += `?access_token=${config.qq.napcatToken}`;
    }

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
      req.destroy(new Error("NapCat HTTP API 请求超时"));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
