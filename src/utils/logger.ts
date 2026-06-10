/**
 * 日志工具
 * 控制台输出（带颜色 + 级别过滤）+ 文件持久化（始终 debug 级别 + 按天轮转 + 自动清理）
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { config } from "../config";
import { nowISO, todayStr } from "./time-utils";

dotenv.config();

type LogLevel = "info" | "warn" | "error" | "debug";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";
const DIM = "\x1b[90m";

/** 控制台日志级别过滤 */
const consoleLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) || "info";

// ====== 文件日志（始终所有级别写入，不受 LOG_LEVEL 控制） ======

let currentDate = "";
let writeQueue: Promise<void> = Promise.resolve();
let dirReady = false;

/** 根据当前日期生成日志文件路径，日期变化时自动切换 */
function getLogPath(): string {
  const today = todayStr();
  if (today !== currentDate) {
    currentDate = today;
  }
  return path.join(config.log.dir, `qqbot-${today}.log`);
}

/** 文件日志格式（本地时间）：2026-06-10 14:30:15.123 [INFO] msg {"key":"value"} */
function formatFileLine(level: LogLevel, msg: string, extra?: Record<string, unknown>): string {
  const ms = String(new Date().getMilliseconds()).padStart(3, "0");
  const ts = `${nowISO()}.${ms}`;
  const extraStr = extra ? ` ${JSON.stringify(extra)}` : "";
  return `${ts} [${level.toUpperCase()}] ${msg}${extraStr}\n`;
}

/** 确保日志目录存在（延迟初始化，首次写入时触发） */
async function ensureDir(): Promise<void> {
  if (!dirReady) {
    await fs.promises.mkdir(config.log.dir, { recursive: true });
    dirReady = true;
  }
}

/** 串行追加一行到日志文件，写入失败只打 console.error */
function appendToFile(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  if (!config.log.fileEnabled) return;
  const line = formatFileLine(level, msg, extra);
  writeQueue = writeQueue
    .then(() => ensureDir())
    .then(() => fs.promises.appendFile(getLogPath(), line, "utf-8"))
    .catch((err: NodeJS.ErrnoException) => {
      console.error(`[LOGGER] 写文件失败: ${err.message}`);
    });
}

// ====== 清理过期日志 ======

/** 删除超过 retentionDays 的日志文件（启动时调用一次） */
export async function cleanOldLogs(): Promise<void> {
  try {
    await fs.promises.mkdir(config.log.dir, { recursive: true });
    const files = await fs.promises.readdir(config.log.dir);
    const cutoff = Date.now() - config.log.retentionDays * 86_400_000;

    let cleaned = 0;
    for (const file of files) {
      const match = file.match(/^qqbot-(\d{4}-\d{2}-\d{2})\.log$/);
      if (!match) continue;
      const fileDate = new Date(match[1]).getTime();
      if (fileDate < cutoff) {
        await fs.promises.unlink(path.join(config.log.dir, file));
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[LOGGER] 已清理 ${cleaned} 个过期日志文件`);
    }
  } catch {
    // 目录不存在等场景静默跳过
  }
}

// ====== 核心 log 函数 ======

function log(level: LogLevel, msg: string, extra?: Record<string, unknown>) {
  // 控制台输出：受 LOG_LEVEL 过滤，带颜色
  if (LOG_LEVELS[level] >= LOG_LEVELS[consoleLevel]) {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    const color = COLORS[level];
    const extraStr = extra ? ` ${DIM}${JSON.stringify(extra)}${RESET}` : "";
    console.log(`${DIM}${time}${RESET} ${color}[${level.toUpperCase()}]${RESET} ${msg}${extraStr}`);
  }

  // 文件输出：始终写入所有级别（包括 debug），不受 LOG_LEVEL 过滤
  appendToFile(level, msg, extra);
}

export const logger = {
  info: (msg: string, extra?: Record<string, unknown>) => log("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => log("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => log("error", msg, extra),
  debug: (msg: string, extra?: Record<string, unknown>) => log("debug", msg, extra),
};
