/**
 * 配置管理
 * 读取环境变量，集中管理 DeepSeek 和 QQ 相关配置，提供校验方法
 */

import dotenv from "dotenv";
dotenv.config();

export const config = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  },
  qq: {
    whitelist: (process.env.QQ_WHITELIST || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    port: parseInt(process.env.PORT || "3456", 10),
    napcatToken: process.env.NAPCAT_TOKEN || "",
    heartbeatMinutes: parseInt(process.env.HEARTBEAT_MINUTES || "120", 10),
    selfId: process.env.QQ_SELF_ID || "",
  },
  agent: {
    maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || "5", 10),
    maxToolResultChars: parseInt(process.env.AGENT_TOOL_RESULT_MAX_CHARS || "1500", 10),
    temperature: parseFloat(process.env.AGENT_TEMPERATURE || "0.3"),
    maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || "1024"),
  },
};

export function validateConfig(): string[] {
  const errors: string[] = [];
  if (!config.deepseek.apiKey) errors.push("DEEPSEEK_API_KEY 未设置");
  if (config.qq.whitelist.length === 0) errors.push("QQ_WHITELIST 为空，机器人不会响应任何消息");
  return errors;
}
