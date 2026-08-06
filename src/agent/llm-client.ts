/**
 * 共享 LLM 客户端
 * 共享 OpenAI 客户端，供 agent-loop 和 qa-fallback 共用
 */

import OpenAI from "openai";
import { config } from "../config/output";

let _client: OpenAI | null = null;

/** 获取共享的 OpenAI 客户端实例（懒加载单例） */
export function getLlmClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: config.deepseek.apiKey,
      baseURL: config.deepseek.baseUrl,
    });
  }
  return _client;
}

