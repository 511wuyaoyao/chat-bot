/**
 * 运行期日志与调试配置。
 */

import { parseInteger } from "./parsers";
import type { LogLevel } from "./types";

function parseLogLevel(value: string | undefined): LogLevel {
  if (value === "debug" || value === "warn" || value === "error") return value;
  return "info";
}

export const logConfig = {
  level: parseLogLevel(process.env.LOG_LEVEL),
  dir: process.env.LOG_DIR || "data/logs",
  retentionDays: parseInteger(process.env.LOG_RETENTION_DAYS, 30),
  fileEnabled: process.env.LOG_FILE_ENABLED !== "false",
};

export const debugConfig = {
  enabled: process.env.DEBUG_DASHBOARD_ENABLED === "true",
  port: parseInteger(process.env.DEBUG_DASHBOARD_PORT, 3457),
  traceMaxKeep: parseInteger(process.env.DEBUG_TRACE_MAX_KEEP, 10),
  traceMaxBytes: parseInteger(process.env.DEBUG_TRACE_MAX_BYTES, 64 * 1024 * 1024),
  detailCacheMaxBytes: parseInteger(process.env.DEBUG_DETAIL_CACHE_MAX_BYTES, 64 * 1024 * 1024),
};
