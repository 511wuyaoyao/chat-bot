/**
 * 豆包图片理解客户端
 * 调用火山方舟 Chat Completions API，将图片转为 agent 可读的中文描述。
 */

import http from "http";
import https from "https";
import { config } from "../../../config/output";
import { logger } from "../../../utils/logger";

interface ArkChatCompletionResponse {
  choices?: {
    message?: {
      content?: string;
    };
  }[];
  usage?: unknown;
}

export interface ImageDescriptionResult {
  text: string;
  usage?: unknown;
}

const IMAGE_PROMPT = [
  "请用中文简洁描述这张图片。",
  "如果图片中有文字，请尽量完整提取文字。",
  "如果是表情包、截图、聊天记录或 UI，请说明它表达的含义。",
  "输出格式：",
  "图片内容：",
  "图片文字：",
  "补充判断：",
].join("\n");

export async function describeImage(imageUrl: string): Promise<ImageDescriptionResult | null> {
  if (!config.ark.apiKey) {
    logger.debug("跳过图片理解：ARK_API_KEY 未配置");
    return null;
  }

  try {
    const response = await postJson(`${config.ark.baseUrl}/chat/completions`, {
      model: config.ark.visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: IMAGE_PROMPT },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        },
      ],
    });

    const parsed = JSON.parse(response) as ArkChatCompletionResponse;
    const text = parsed.choices?.[0]?.message?.content?.trim();
    return text ? { text, usage: parsed.usage } : null;
  } catch (err) {
    logger.warn("图片理解失败", { error: String(err) });
    return null;
  }
}

function postJson(url: string, body: unknown): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const urlObj = new URL(url);
    const transport = urlObj.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: urlObj.hostname,
        port: urlObj.port,
        path: `${urlObj.pathname}${urlObj.search}`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.ark.apiKey}`,
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

    req.setTimeout(90_000, () => {
      req.destroy(new Error("火山方舟图片理解请求超时"));
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}
