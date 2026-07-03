/**
 * 配置管理
 * 读取环境变量，集中管理 DeepSeek 和 QQ 相关配置，提供校验方法
 */

import dotenv from "dotenv";
dotenv.config();

function parseStringList(value: string | undefined): string[] {
  const raw = value?.trim();
  if (!raw) return [];

  if (raw.startsWith("[") && raw.endsWith("]")) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }

  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || "",
    baseUrl: process.env.TAVILY_BASE_URL || "https://api.tavily.com",
  },
  ark: {
    apiKey: process.env.ARK_API_KEY || "",
    baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
    visionModel: process.env.ARK_VISION_MODEL || "doubao-seed-2-1-pro-260628",
  },
  qq: {
    userWhitelist: parseStringList(process.env.QQ_USER_WHITELIST || process.env.QQ_WHITELIST),
    groupWhitelist: parseStringList(process.env.QQ_GROUP_WHITELIST),
    whitelist: parseStringList(process.env.QQ_USER_WHITELIST || process.env.QQ_WHITELIST),
    adminIds: parseStringList(process.env.QQ_ADMIN_IDS || process.env.QQ_ADMIN_ID || process.env.QQ_SELF_ID),
    adminName: process.env.QQ_ADMIN_NAME || "",
    port: parseInt(process.env.PORT || "3456", 10),
    napcatToken: process.env.NAPCAT_TOKEN || "",
    heartbeatMinutes: parseInt(process.env.HEARTBEAT_MINUTES || "15", 10),
    heartbeatFailThreshold: parseInt(process.env.HEARTBEAT_FAIL_THRESHOLD || "3", 10),
    wsPingIntervalSeconds: parseInt(process.env.WS_PING_INTERVAL_SECONDS || "30", 10),
    wsPingSummaryMinutes: parseInt(process.env.WS_PING_SUMMARY_MINUTES || "5", 10),
    selfId: process.env.QQ_SELF_ID || "",
  },
  agent: {
    maxIterations: parseInt(process.env.AGENT_MAX_ITERATIONS || "5", 10),
    maxToolResultChars: parseInt(process.env.AGENT_TOOL_RESULT_MAX_CHARS || "1500", 10),
    temperature: parseFloat(process.env.AGENT_TEMPERATURE || "0.3"),
    maxTokens: parseInt(process.env.AGENT_MAX_TOKENS || "1024"),
    contextMaxMessages: parseInt(process.env.AGENT_CONTEXT_MAX_MESSAGES || "24", 10),
    contextMaxChars: parseInt(process.env.AGENT_CONTEXT_MAX_CHARS || "24000", 10),
    transactionEventMaxKeep: parseInt(process.env.AGENT_TRANSACTION_EVENT_MAX_KEEP || "20", 10),
    transactionEventAttentionLimit: parseInt(process.env.AGENT_TRANSACTION_EVENT_ATTENTION_LIMIT || "3", 10),
  },
  /** 执行 Agent 独立参数，不配置则回退到 agent 默认值 */
  exec: {
    model: process.env.EXEC_MODEL || "",
    temperature: parseFloat(process.env.EXEC_TEMPERATURE || "0"),
    maxTokens: parseInt(process.env.EXEC_MAX_TOKENS || "0"),
    maxIterations: parseInt(process.env.EXEC_MAX_ITERATIONS || "8"),
  },
  log: {
    dir: process.env.LOG_DIR || "data/logs",
    retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || "30", 10),
    fileEnabled: process.env.LOG_FILE_ENABLED !== "false",
  },
  debug: {
    enabled: process.env.DEBUG_DASHBOARD_ENABLED === "true",
    port: parseInt(process.env.DEBUG_DASHBOARD_PORT || "3457", 10),
    traceMaxKeep: parseInt(process.env.DEBUG_TRACE_MAX_KEEP || "10", 10),
  },
};

export function validateConfig(): string[] {
  const errors: string[] = [];
  if (!config.deepseek.apiKey) errors.push("DEEPSEEK_API_KEY 未设置");
  if (config.qq.userWhitelist.length === 0) errors.push("QQ_USER_WHITELIST/QQ_WHITELIST 为空，机器人不会响应任何用户消息");
  return errors;
}
