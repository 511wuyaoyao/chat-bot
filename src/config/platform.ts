/**
 * QQ 平台与外部协议适配配置。
 */

import { parseBoolean, parseInteger, parseStringList } from "./parsers";
import { parseQQIdentityConfig } from "./identity";
import type { PlatformAdapter, QQBotTransport } from "./types";

function parsePlatformAdapter(value: string | undefined): PlatformAdapter {
  if (value === "qqbot-official") return "qqbot-official";
  return "napcat";
}

function parseQQBotTransport(value: string | undefined): QQBotTransport {
  if (value === "webhook") return "webhook";
  return "websocket";
}

export const platformConfig = {
  adapter: parsePlatformAdapter(process.env.PLATFORM_ADAPTER),
};

let identityErrors: string[] = [];
let identityConfig: ReturnType<typeof parseQQIdentityConfig>;
try {
  identityConfig = parseQQIdentityConfig(process.env);
} catch (err) {
  identityErrors = [String(err instanceof Error ? err.message : err)];
  identityConfig = {
    users: [],
    accountToUser: {},
    userWhitelist: [],
    legacyAccountWhitelist: parseStringList(process.env.QQ_USER_WHITELIST),
    adminIds: parseStringList(process.env.QQ_ADMIN_IDS),
  };
}

export const qqConfig = {
  users: identityConfig.users,
  accountToUser: identityConfig.accountToUser,
  usersJsonConfigured: Boolean(process.env.QQ_USERS_JSON?.trim()),
  usersJsonRaw: process.env.QQ_USERS_JSON || "",
  identityErrors,
  userWhitelist: identityConfig.userWhitelist,
  legacyAccountWhitelist: identityConfig.legacyAccountWhitelist,
  groupWhitelist: parseStringList(process.env.QQ_GROUP_WHITELIST),
  whitelist: identityConfig.userWhitelist,
  adminIds: identityConfig.adminIds,
  adminName: process.env.QQ_ADMIN_NAME || "",
  port: parseInteger(process.env.PORT, 3456),
  napcatBaseUrl: process.env.NAPCAT_BASE_URL || "http://127.0.0.1:3000",
  napcatToken: process.env.NAPCAT_TOKEN || "",
  heartbeatMinutes: parseInteger(process.env.HEARTBEAT_MINUTES, 15),
  heartbeatFailThreshold: parseInteger(process.env.HEARTBEAT_FAIL_THRESHOLD, 3),
  wsPingIntervalSeconds: parseInteger(process.env.WS_PING_INTERVAL_SECONDS, 30),
  wsPingSummaryMinutes: parseInteger(process.env.WS_PING_SUMMARY_MINUTES, 5),
  napcatRawEventLogEnabled: parseBoolean(process.env.NAPCAT_RAW_EVENT_LOG_ENABLED),
  qqbot: {
    appId: process.env.QQBOT_APP_ID || "",
    appSecret: process.env.QQBOT_APP_SECRET || "",
    apiBaseUrl: process.env.QQBOT_API_BASE_URL || "https://api.sgroup.qq.com",
    apiTimeoutMs: parseInteger(process.env.QQBOT_API_TIMEOUT_MS, 30_000),
    transport: parseQQBotTransport(process.env.QQBOT_TRANSPORT),
    webhookPath: process.env.QQBOT_WEBHOOK_PATH || "/qqbot/webhook",
    rawEventLogEnabled: parseBoolean(process.env.QQBOT_RAW_EVENT_LOG_ENABLED),
  },
};
