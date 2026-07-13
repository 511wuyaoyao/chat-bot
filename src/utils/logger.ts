/**
 * 鏃ュ織宸ュ叿锛氭帶鍒跺彴褰╄壊杈撳嚭涓庢枃浠舵寔涔呭寲銆?
 * 鑷姩浠庤皟鐢ㄦ爤鎺ㄦ柇 src 涓€绾фā鍧楀悕锛屼笟鍔℃ā鍧楁棤闇€鎵嬪姩澹版槑鏉ユ簮銆?
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

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[36m",
  info: "\x1b[32m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const MODULE_COLORS = [
  "\x1b[35m",
  "\x1b[34m",
  "\x1b[36m",
  "\x1b[32m",
  "\x1b[33m",
  "\x1b[95m",
  "\x1b[94m",
  "\x1b[96m",
];

const RESET = "\x1b[0m";
const DIM = "\x1b[90m";

const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
const consoleLevel: LogLevel = envLevel && envLevel in LOG_LEVELS ? envLevel : "info";

let currentDate = "";
let writeQueue: Promise<void> = Promise.resolve();
let dirReady = false;

function getLogPath(): string {
  const today = todayStr();
  if (today !== currentDate) currentDate = today;
  return path.join(config.log.dir, `qqbot-${today}.log`);
}

function formatFileLine(
  level: LogLevel,
  moduleName: string,
  userLabel: string,
  msg: string,
  extra?: Record<string, unknown>
): string {
  const ms = String(new Date().getMilliseconds()).padStart(3, "0");
  const ts = `${nowISO()}.${ms}`;
  const extraStr = extra ? ` ${safeJson(extra)}` : "";
  return `${ts} [${userLabel}] [${level.toUpperCase()}] [${moduleName}] ${msg}${extraStr}
`;
}

async function ensureDir(): Promise<void> {
  if (!dirReady) {
    await fs.promises.mkdir(config.log.dir, { recursive: true });
    dirReady = true;
  }
}

function appendToFile(
  level: LogLevel,
  moduleName: string,
  userLabel: string,
  msg: string,
  extra?: Record<string, unknown>
): void {
  if (!config.log.fileEnabled) return;
  const line = formatFileLine(level, moduleName, userLabel, msg, extra);
  writeQueue = writeQueue
    .then(() => ensureDir())
    .then(() => fs.promises.appendFile(getLogPath(), line, "utf-8"))
    .catch((err: NodeJS.ErrnoException) => {
      console.error(`[LOGGER] failed to write log file ${err.message}`);
    });
}

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

    if (cleaned > 0) console.log(`[LOGGER] cleaned ${cleaned} expired log files`);
  } catch {
    // Log cleanup must not block application startup.
  }
}

function log(level: LogLevel, msg: string, extra?: Record<string, unknown>): void {
  const moduleName = inferModuleName();
  const userLabel = inferUserLabel(extra);

  if (LOG_LEVELS[level] >= LOG_LEVELS[consoleLevel]) {
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    const userText = `${userColor(userLabel)}[${userLabel}]${RESET}`;
    const levelText = `${LEVEL_COLORS[level]}[${level.toUpperCase()}]${RESET}`;
    const moduleText = `${moduleColor(moduleName)}[${moduleName}]${RESET}`;
    const extraStr = extra ? ` ${DIM}${safeJson(extra)}${RESET}` : "";
    console.log(`${DIM}${time}${RESET} ${userText} ${levelText} ${moduleText} ${msg}${extraStr}`);
  }

  appendToFile(level, moduleName, userLabel, msg, extra);
}

function inferModuleName(): string {
  const stack = new Error().stack;
  if (!stack) return "unknown";

  for (const line of stack.split("\n").slice(1)) {
    const filePath = extractFilePath(line);
    if (!filePath) continue;

    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.endsWith("/utils/logger.ts") || normalized.endsWith("/utils/logger.js")) {
      continue;
    }

    const moduleName = moduleNameFromPath(normalized, "/src/") ?? moduleNameFromPath(normalized, "/dist/");
    if (moduleName) return moduleName;
  }

  return "unknown";
}

function extractFilePath(stackLine: string): string | null {
  const match = stackLine.match(/\(?([A-Za-z]:[/\\][^():]+|\/[^():]+):\d+:\d+\)?/);
  return match?.[1] ?? null;
}

function moduleNameFromPath(filePath: string, rootMarker: "/src/" | "/dist/"): string | null {
  const index = filePath.lastIndexOf(rootMarker);
  if (index < 0) return null;

  const rest = filePath.slice(index + rootMarker.length);
  if (!rest || rest.startsWith("index.")) return "app";

  const first = rest.split("/")[0];
  return first || "unknown";
}

function moduleColor(moduleName: string): string {
  let hash = 0;
  for (const char of moduleName) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return MODULE_COLORS[hash % MODULE_COLORS.length];
}

function userColor(userLabel: string): string {
  if (userLabel === "system") return DIM;
  return "\x1b[2;36m";
}

function inferUserLabel(extra?: Record<string, unknown>): string {
  const userId = findUserId(extra);
  if (userId === null) return "system";
  return `user:${userId}`;
}

function findUserId(value: unknown): string | null {
  if (!isPlainRecord(value)) return null;

  for (const key of ["user_id", "userId", "uid", "sender_user_id"]) {
    const normalized = normalizeUserId(value[key]);
    if (normalized !== null) return normalized;
  }

  for (const key of ["last", "message", "msg", "context"]) {
    const nested = findUserId(value[key]);
    if (nested !== null) return nested;
  }

  return null;
}

function normalizeUserId(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeJson(value: Record<string, unknown>): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ unserializable: true });
  }
}

export const logger = {
  info: (msg: string, extra?: Record<string, unknown>) => log("info", msg, extra),
  warn: (msg: string, extra?: Record<string, unknown>) => log("warn", msg, extra),
  error: (msg: string, extra?: Record<string, unknown>) => log("error", msg, extra),
  debug: (msg: string, extra?: Record<string, unknown>) => log("debug", msg, extra),
};

