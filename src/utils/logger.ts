/**
 * 控制台日志工具
 * 带颜色标记、时间戳和日志级别过滤
 */

import dotenv from "dotenv";
dotenv.config();

type LogLevel = "info" | "warn" | "error" | "debug";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",  // cyan
  info: "\x1b[32m",   // green
  warn: "\x1b[33m",   // yellow
  error: "\x1b[31m",  // red
};

const RESET = "\x1b[0m";
const DIM = "\x1b[90m";

const currentLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

function log(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) return;
  const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
  const color = COLORS[level];
  const extraStr = extra ? ` ${DIM}${JSON.stringify(extra)}${RESET}` : "";
  console.log(`${DIM}${time}${RESET} ${color}[${level.toUpperCase()}]${RESET} ${msg}${extraStr}`);
}

export const logger = {
  info: (msg: string, extra?: Record<string, unknown>) => log("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => log("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => log("error", msg, extra),
  debug: (msg: string, extra?: Record<string, unknown>) => log("debug", msg, extra),
};
