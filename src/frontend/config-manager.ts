/**
 * Debug 面板配置热更新与 env 文件写回管理。
 */

import fs from "fs";
import path from "path";
import { buildQQIdentityConfig, parseQQUsersJson } from "../config/identity";
import { config, validateConfig } from "../config/output";
import { parseBoolean, parseNumber, parseStringList } from "../config/parsers";
import { debugDetailCache } from "./detail-cache";
import { enforceDebugTraceLimits } from "./trace-store";

type ConfigFieldType = "string" | "number" | "boolean" | "stringList" | "json" | "select" | "secretStatus";
type ConfigFieldGroup = "platform" | "platformNapcat" | "platformQqbot" | "access" | "agent" | "models" | "debug" | "status";
type ConfigValue = string | number | boolean | string[];

interface ConfigFieldDefinition {
  key: string;
  label: string;
  group: ConfigFieldGroup;
  type: ConfigFieldType;
  envFile?: string | (() => string);
  editable: boolean;
  sensitive?: boolean;
  description?: string;
  min?: number;
  max?: number;
  getValue: () => ConfigValue;
  setValue?: (value: ConfigValue) => void;
  configured?: () => boolean;
  options?: Array<{ label: string; value: string }>;
  afterApply?: () => void;
}

export interface DebugConfigField {
  key: string;
  label: string;
  group: ConfigFieldGroup;
  type: ConfigFieldType;
  value: ConfigValue | null;
  editable: boolean;
  sensitive: boolean;
  description: string;
  min?: number;
  max?: number;
  configured?: boolean;
  options?: Array<{ label: string; value: string }>;
}

export interface DebugConfigGroup {
  id: ConfigFieldGroup;
  label: string;
}

export interface DebugConfigState {
  groups: DebugConfigGroup[];
  fields: DebugConfigField[];
  readOnlyStatus: Record<string, unknown>;
  validationErrors: string[];
}

export interface DebugConfigPatchResult extends DebugConfigState {
  success: boolean;
  updated: string[];
}

export interface DebugConfigPatchError {
  success: false;
  errors: Record<string, string>;
}

const groups: DebugConfigGroup[] = [
  { id: "platform", label: "Platform" },
  { id: "platformNapcat", label: "NapCat" },
  { id: "platformQqbot", label: "QQBot Official" },
  { id: "access", label: "Access" },
  { id: "agent", label: "Agent" },
  { id: "models", label: "Model Overrides" },
  { id: "debug", label: "Debug Limits" },
  { id: "status", label: "Read-only Status" },
];

const envPath = (file: string): string => path.join("env", file);
const accessEnvFile = envPath(".env.access");

const platformEnvFile = (): string => {
  return config.platform.adapter === "qqbot-official" ? envPath(".env.platform.qqbot") : envPath(".env.platform.napcat");
};

const fieldRegistry: ConfigFieldDefinition[] = [
  {
    key: "PLATFORM_ADAPTER",
    label: "Active adapter",
    group: "platform",
    type: "select",
    envFile: envPath(".env"),
    editable: true,
    description: "Hot reloads the current platform transport after save.",
    options: [
      { label: "NapCat / OneBot11", value: "napcat" },
      { label: "QQ official bot", value: "qqbot-official" },
    ],
    getValue: () => config.platform.adapter,
    setValue: (value) => {
      config.platform.adapter = value === "qqbot-official" ? "qqbot-official" : "napcat";
    },
    afterApply: () => runPlatformReloadHooks(),
  },
  numberField("PORT", "Adapter HTTP port", "platform", 1, 65535, () => config.qq.port, (value) => {
    config.qq.port = value as number;
  }, platformEnvFile, () => runPlatformReloadHooks(), "本地 adapter HTTP 端口。保存后会重建当前平台 adapter。"),
  numberField("WS_PING_INTERVAL_SECONDS", "WebSocket ping interval (s)", "platform", 1, 3600, () => config.qq.wsPingIntervalSeconds, (value) => {
    config.qq.wsPingIntervalSeconds = value as number;
  }, platformEnvFile, () => runPlatformReloadHooks(), "WebSocket ping 间隔，单位秒。保存后会重建当前平台 adapter。"),
  numberField("WS_PING_SUMMARY_MINUTES", "WebSocket ping summary (min)", "platform", 1, 1440, () => config.qq.wsPingSummaryMinutes, (value) => {
    config.qq.wsPingSummaryMinutes = value as number;
  }, platformEnvFile, () => runPlatformReloadHooks(), "WebSocket 心跳统计日志折叠汇总间隔，单位分钟。保存后会重建当前平台 adapter。"),
  numberField("HEARTBEAT_MINUTES", "Message heartbeat interval (min)", "platform", 0, 1440, () => config.qq.heartbeatMinutes, (value) => {
    config.qq.heartbeatMinutes = value as number;
  }, platformEnvFile, () => runHeartbeatReloadHooks(), "业务消息心跳间隔，单位分钟；0 表示禁用。保存后会重启消息心跳。"),
  numberField("HEARTBEAT_FAIL_THRESHOLD", "Message heartbeat fail threshold", "platform", 1, 100, () => config.qq.heartbeatFailThreshold, (value) => {
    config.qq.heartbeatFailThreshold = value as number;
  }, platformEnvFile, () => runHeartbeatReloadHooks(), "业务消息心跳连续失败告警阈值。保存后会重启消息心跳。"),
  stringField("NAPCAT_BASE_URL", "NapCat base URL", "platformNapcat", () => config.qq.napcatBaseUrl, (value) => {
    config.qq.napcatBaseUrl = value as string;
  }, envPath(".env.platform.napcat"), "NapCat / OneBot11 HTTP endpoint. 保存后会重建当前平台 adapter。", () => runPlatformReloadHooks()),
  booleanField("NAPCAT_RAW_EVENT_LOG_ENABLED", "NapCat raw event log", "platformNapcat", () => config.qq.napcatRawEventLogEnabled, (value) => {
    config.qq.napcatRawEventLogEnabled = value as boolean;
  }, envPath(".env.platform.napcat"), "是否打印 NapCat 原始事件。保存后会重建当前平台 adapter。", () => runPlatformReloadHooks()),
  {
    key: "QQBOT_TRANSPORT",
    label: "QQBot transport",
    group: "platformQqbot",
    type: "select",
    envFile: envPath(".env.platform.qqbot"),
    editable: true,
    description: "websocket actively connects to QQ official Gateway; webhook waits for public HTTPS callbacks.",
    options: [
      { label: "WebSocket Gateway", value: "websocket" },
      { label: "Webhook callback", value: "webhook" },
    ],
    getValue: () => config.qq.qqbot.transport,
    setValue: (value) => {
      config.qq.qqbot.transport = value === "webhook" ? "webhook" : "websocket";
    },
    afterApply: () => runPlatformReloadHooks(),
  },
  stringField("QQBOT_APP_ID", "QQBot AppID", "platformQqbot", () => config.qq.qqbot.appId, (value) => {
    config.qq.qqbot.appId = value as string;
  }, envPath(".env.platform.qqbot"), "QQ 官方机器人 AppID。非密钥，保存后会重建 QQBot adapter。", () => runPlatformReloadHooks()),
  stringField("QQBOT_API_BASE_URL", "QQBot API base URL", "platformQqbot", () => config.qq.qqbot.apiBaseUrl, (value) => {
    config.qq.qqbot.apiBaseUrl = value as string;
  }, envPath(".env.platform.qqbot"), "QQ 官方 OpenAPI base URL。保存后会重建 QQBot client。", () => runPlatformReloadHooks()),
  numberField("QQBOT_API_TIMEOUT_MS", "QQBot API timeout (ms)", "platformQqbot", 1000, 3_600_000, () => config.qq.qqbot.apiTimeoutMs, (value) => {
    config.qq.qqbot.apiTimeoutMs = value as number;
  }, envPath(".env.platform.qqbot"), () => runPlatformReloadHooks(), "单位是毫秒。常用值：30000=30秒，60000=1分钟，120000=2分钟，3000000=50分钟。保存后会热重载 QQBot client。"),
  stringField("QQBOT_WEBHOOK_PATH", "QQBot webhook path", "platformQqbot", () => config.qq.qqbot.webhookPath, (value) => {
    config.qq.qqbot.webhookPath = value as string;
  }, envPath(".env.platform.qqbot"), "QQBot webhook 本地路径，仅 webhook transport 使用。保存后会重建 QQBot adapter。", () => runPlatformReloadHooks()),
  booleanField("QQBOT_RAW_EVENT_LOG_ENABLED", "QQBot raw event log", "platformQqbot", () => config.qq.qqbot.rawEventLogEnabled, (value) => {
    config.qq.qqbot.rawEventLogEnabled = value as boolean;
  }, envPath(".env.platform.qqbot"), "是否打印 QQBot Gateway/Webhook 原始事件。保存后会重建 QQBot adapter。", () => runPlatformReloadHooks()),
  jsonField("QQ_USERS_JSON", "Users", "access", () => usersJsonValue(), (value) => {
    applyUsersJson(String(value));
  }, accessEnvFile, "Shared identity model for every platform adapter. Each person can own multiple platform accounts and future fields.", () => runAccessReloadHooks()),
  stringListField("QQ_GROUP_WHITELIST", "Group whitelist", "access", () => config.qq.groupWhitelist, (value) => {
    config.qq.groupWhitelist = value as string[];
  }, accessEnvFile),
  stringListField("QQ_ADMIN_IDS", "Admin IDs", "access", () => config.qq.adminIds, (value) => {
    config.qq.adminIds = value as string[];
  }, accessEnvFile),
  stringField("QQ_ADMIN_NAME", "Admin name", "access", () => config.qq.adminName, (value) => {
    config.qq.adminName = value as string;
  }, accessEnvFile),

  {
    key: "AGENT_THINK_MODE",
    label: "Think mode",
    group: "agent",
    type: "select",
    envFile: envPath(".env.agent"),
    editable: true,
    description: "Controls model thinking parameters for OpenAI-compatible chat calls.",
    options: [
      { label: "Disabled", value: "non-thinking" },
      { label: "Thinking", value: "thinking" },
      { label: "Thinking max", value: "thinking_max" },
    ],
    getValue: () => config.agent.thinkMode,
    setValue: (value) => {
      config.agent.thinkMode = value === "thinking" || value === "thinking_max" ? value : "non-thinking";
    },
  },
  numberField("AGENT_MAX_ITERATIONS", "Max iterations", "agent", 1, 50, () => config.agent.maxIterations, (value) => {
    config.agent.maxIterations = value as number;
  }),
  numberField("AGENT_TEMPERATURE", "Temperature", "agent", 0, 2, () => config.agent.temperature, (value) => {
    config.agent.temperature = value as number;
  }),
  numberField("AGENT_MAX_TOKENS", "Max tokens", "agent", 1, 200000, () => config.agent.maxTokens, (value) => {
    config.agent.maxTokens = value as number;
  }),
  numberField("AGENT_TOOL_RESULT_MAX_CHARS", "Tool result max chars", "agent", 100, 200000, () => config.agent.maxToolResultChars, (value) => {
    config.agent.maxToolResultChars = value as number;
  }),
  numberField("AGENT_CONTEXT_MAX_MESSAGES", "Context max messages", "agent", 1, 500, () => config.agent.contextMaxMessages, (value) => {
    config.agent.contextMaxMessages = value as number;
  }),
  numberField("AGENT_CONTEXT_MAX_CHARS", "Context max chars", "agent", 1000, 1000000, () => config.agent.contextMaxChars, (value) => {
    config.agent.contextMaxChars = value as number;
  }),
  numberField("AGENT_TRANSACTION_EVENT_MAX_KEEP", "Transaction events max keep", "agent", 1, 500, () => config.agent.transactionEventMaxKeep, (value) => {
    config.agent.transactionEventMaxKeep = value as number;
  }),
  numberField("AGENT_TRANSACTION_EVENT_ATTENTION_LIMIT", "Transaction attention limit", "agent", 0, 100, () => config.agent.transactionEventAttentionLimit, (value) => {
    config.agent.transactionEventAttentionLimit = value as number;
  }),

  modelField("MAIN_MODEL", "Main model", () => config.main.model, (value) => { config.main.model = value as string; }),
  numberField("MAIN_TEMPERATURE", "Main temperature", "models", 0, 2, () => config.main.temperature, (value) => { config.main.temperature = value as number; }),
  numberField("MAIN_MAX_TOKENS", "Main max tokens", "models", 1, 200000, () => config.main.maxTokens, (value) => { config.main.maxTokens = value as number; }),
  numberField("MAIN_MAX_ITERATIONS", "Main max iterations", "models", 1, 50, () => config.main.maxIterations, (value) => { config.main.maxIterations = value as number; }),
  modelField("TOPIC_MODEL", "Topic model", () => config.topic.model, (value) => { config.topic.model = value as string; }),
  numberField("TOPIC_TEMPERATURE", "Topic temperature", "models", 0, 2, () => config.topic.temperature, (value) => { config.topic.temperature = value as number; }),
  numberField("TOPIC_MAX_TOKENS", "Topic max tokens", "models", 1, 200000, () => config.topic.maxTokens, (value) => { config.topic.maxTokens = value as number; }),
  numberField("TOPIC_MAX_ITERATIONS", "Topic max iterations", "models", 1, 50, () => config.topic.maxIterations, (value) => { config.topic.maxIterations = value as number; }),
  modelField("EXEC_MODEL", "Exec model", () => config.exec.model, (value) => { config.exec.model = value as string; }),
  numberField("EXEC_TEMPERATURE", "Exec temperature", "models", 0, 2, () => config.exec.temperature, (value) => { config.exec.temperature = value as number; }),
  numberField("EXEC_MAX_TOKENS", "Exec max tokens", "models", 1, 200000, () => config.exec.maxTokens, (value) => { config.exec.maxTokens = value as number; }),
  numberField("EXEC_MAX_ITERATIONS", "Exec max iterations", "models", 1, 50, () => config.exec.maxIterations, (value) => { config.exec.maxIterations = value as number; }),

  numberField("DEBUG_TRACE_MAX_KEEP", "Trace max keep", "debug", 1, 1000, () => config.debug.traceMaxKeep, (value) => {
    config.debug.traceMaxKeep = value as number;
  }, envPath(".env.debug"), () => enforceDebugTraceLimits()),
  {
    key: "LOG_LEVEL",
    label: "Console log level",
    group: "debug",
    type: "select",
    envFile: envPath(".env.log"),
    editable: true,
    description: "Controls terminal log visibility. File logging still writes through the unified logger.",
    options: [
      { label: "Debug", value: "debug" },
      { label: "Info", value: "info" },
      { label: "Warn", value: "warn" },
      { label: "Error", value: "error" },
    ],
    getValue: () => config.log.level,
    setValue: (value) => {
      config.log.level = value === "debug" || value === "warn" || value === "error" ? value : "info";
    },
  },
  numberField("DEBUG_TRACE_MAX_BYTES", "Trace max bytes", "debug", 0, 1024 * 1024 * 1024, () => config.debug.traceMaxBytes, (value) => {
    config.debug.traceMaxBytes = value as number;
  }, envPath(".env.debug"), () => enforceDebugTraceLimits()),
  numberField("DEBUG_DETAIL_CACHE_MAX_BYTES", "Detail cache max bytes", "debug", 0, 1024 * 1024 * 1024, () => config.debug.detailCacheMaxBytes, (value) => {
    config.debug.detailCacheMaxBytes = value as number;
    debugDetailCache.setMaxBytes(value as number);
  }, envPath(".env.debug")),

  secretStatusField("DEEPSEEK_API_KEY", "DeepSeek API key", () => Boolean(config.deepseek.apiKey)),
  secretStatusField("TAVILY_API_KEY", "Tavily API key", () => Boolean(config.tavily.apiKey)),
  secretStatusField("ARK_API_KEY", "Ark API key", () => Boolean(config.ark.apiKey)),
  secretStatusField("NAPCAT_TOKEN", "NapCat token", () => Boolean(config.qq.napcatToken), "platformNapcat"),
  secretStatusField("QQBOT_APP_SECRET", "QQBot app secret", () => Boolean(config.qq.qqbot.appSecret), "platformQqbot"),
];

export function getDebugConfigState(): DebugConfigState {
  return {
    groups,
    fields: fieldRegistry.map(toPublicField),
    readOnlyStatus: {
      platformAdapter: config.platform.adapter,
      qqbotTransport: config.qq.qqbot.transport,
      qqbotApiTimeoutMs: config.qq.qqbot.apiTimeoutMs,
      usersJsonConfigured: config.qq.usersJsonConfigured,
      legacyAccountWhitelist: config.qq.legacyAccountWhitelist,
      userCount: config.qq.users.length,
      accountMappingCount: Object.keys(config.qq.accountToUser).length,
      napcatConfigured: Boolean(config.qq.napcatBaseUrl),
      qqbotConfigured: Boolean(config.qq.qqbot.appId && config.qq.qqbot.appSecret),
      deepseekConfigured: Boolean(config.deepseek.apiKey),
      tavilyConfigured: Boolean(config.tavily.apiKey),
      arkConfigured: Boolean(config.ark.apiKey),
    },
    validationErrors: validateConfig(),
  };
}

export function patchDebugConfig(values: Record<string, unknown>): DebugConfigPatchResult | DebugConfigPatchError {
  const errors: Record<string, string> = {};
  const updates: Array<{ field: ConfigFieldDefinition; value: ConfigValue }> = [];

  for (const [key, rawValue] of Object.entries(values)) {
    const field = fieldRegistry.find((item) => item.key === key);
    if (!field) {
      errors[key] = "Unknown config field";
      continue;
    }
    if (!field.editable || field.sensitive) {
      errors[key] = "This config field cannot be edited from the debug panel";
      continue;
    }

    const parsed = parseFieldValue(field, rawValue);
    if (!parsed.ok) {
      errors[key] = parsed.error;
      continue;
    }
    updates.push({ field, value: parsed.value });
  }

  if (Object.keys(errors).length > 0) return { success: false, errors };

  const previousValues = updates.map(({ field }) => ({ field, value: field.getValue() }));
  try {
    for (const { field, value } of updates) {
      field.setValue?.(value);
      process.env[field.key] = serializeEnvValue(value);
    }
    for (const { field, value } of updates) {
      writeEnvValue(resolveEnvFile(field), field.key, serializeEnvValue(value));
    }
    for (const { field } of updates) field.afterApply?.();
  } catch (err) {
    for (const { field, value } of previousValues) {
      field.setValue?.(value);
      process.env[field.key] = serializeEnvValue(value);
    }
    return { success: false, errors: { _global: `Save failed: ${String(err)}` } };
  }

  return {
    success: true,
    updated: updates.map(({ field }) => field.key),
    ...getDebugConfigState(),
  };
}

function stringListField(
  key: string,
  label: string,
  group: ConfigFieldGroup,
  getValue: () => string[],
  setValue: (value: ConfigValue) => void,
  envFile: string | (() => string) = platformEnvFile
): ConfigFieldDefinition {
  return {
    key,
    label,
    group,
    type: "stringList",
    envFile,
    editable: true,
    description: "Comma or newline separated. Values are normalized on save.",
    getValue,
    setValue,
  };
}

function stringField(
  key: string,
  label: string,
  group: ConfigFieldGroup,
  getValue: () => string,
  setValue: (value: ConfigValue) => void,
  envFile: string | (() => string),
  description?: string,
  afterApply?: () => void
): ConfigFieldDefinition {
  return { key, label, group, type: "string", envFile, editable: true, getValue, setValue, description, afterApply };
}

function booleanField(
  key: string,
  label: string,
  group: ConfigFieldGroup,
  getValue: () => boolean,
  setValue: (value: ConfigValue) => void,
  envFile: string | (() => string),
  description?: string,
  afterApply?: () => void
): ConfigFieldDefinition {
  return { key, label, group, type: "boolean", envFile, editable: true, getValue, setValue, description, afterApply };
}

function jsonField(
  key: string,
  label: string,
  group: ConfigFieldGroup,
  getValue: () => string,
  setValue: (value: ConfigValue) => void,
  envFile: string,
  description: string,
  afterApply?: () => void
): ConfigFieldDefinition {
  return { key, label, group, type: "json", envFile, editable: true, description, getValue, setValue, afterApply };
}

function modelField(
  key: string,
  label: string,
  getValue: () => string,
  setValue: (value: ConfigValue) => void
): ConfigFieldDefinition {
  return stringField(key, label, "models", getValue, setValue, envPath(".env.agent"));
}

function numberField(
  key: string,
  label: string,
  group: ConfigFieldGroup,
  min: number,
  max: number,
  getValue: () => number,
  setValue: (value: ConfigValue) => void,
  envFile: string | (() => string) = envPath(".env.agent"),
  afterApply?: () => void,
  description?: string
): ConfigFieldDefinition {
  return { key, label, group, type: "number", envFile, editable: true, min, max, getValue, setValue, afterApply, description };
}

function secretStatusField(
  key: string,
  label: string,
  configured: () => boolean,
  group: ConfigFieldGroup = "status"
): ConfigFieldDefinition {
  return {
    key,
    label,
    group,
    type: "secretStatus",
    editable: false,
    sensitive: true,
    configured,
    getValue: () => "",
  };
}

function toPublicField(field: ConfigFieldDefinition): DebugConfigField {
  const sensitive = Boolean(field.sensitive);
  return {
    key: field.key,
    label: field.label,
    group: field.group,
    type: field.type,
    value: sensitive ? null : field.getValue(),
    editable: field.editable,
    sensitive,
    description: field.description ?? "",
    min: field.min,
    max: field.max,
    configured: field.configured?.(),
    options: field.options,
  };
}

function parseFieldValue(field: ConfigFieldDefinition, value: unknown): { ok: true; value: ConfigValue } | { ok: false; error: string } {
  if (field.type === "stringList") {
    const parsed = Array.isArray(value)
      ? value.map((item) => String(item).trim()).filter(Boolean)
      : parseStringList(String(value ?? "").replace(/\r?\n/g, ","));
    return { ok: true, value: parsed };
  }

  if (field.type === "json") {
    const raw = String(value ?? "").trim();
    if (!raw) return { ok: false, error: "JSON must not be empty" };
    try {
      const users = parseQQUsersJson(raw);
      return { ok: true, value: JSON.stringify(users) };
    } catch (err) {
      return { ok: false, error: String(err instanceof Error ? err.message : err) };
    }
  }

  if (field.type === "number") {
    const parsed = typeof value === "number" ? value : parseNumber(String(value ?? ""), Number.NaN);
    if (!Number.isFinite(parsed)) return { ok: false, error: "Must be a valid number" };
    if (field.min !== undefined && parsed < field.min) return { ok: false, error: `Must be >= ${field.min}` };
    if (field.max !== undefined && parsed > field.max) return { ok: false, error: `Must be <= ${field.max}` };
    return { ok: true, value: parsed };
  }

  if (field.type === "select") {
    const parsed = String(value ?? "").trim();
    const allowed = field.options?.some((option) => option.value === parsed);
    if (!allowed) return { ok: false, error: "Invalid option" };
    return { ok: true, value: parsed };
  }

  if (field.type === "boolean") {
    return { ok: true, value: typeof value === "boolean" ? value : parseBoolean(String(value ?? ""), false) };
  }

  return { ok: true, value: String(value ?? "").trim() };
}

const platformReloadHooks = new Set<() => void>();
const accessReloadHooks = new Set<() => void>();
const heartbeatReloadHooks = new Set<() => void>();

export function registerPlatformReloadHook(hook: () => void): () => void {
  platformReloadHooks.add(hook);
  return () => platformReloadHooks.delete(hook);
}

export function registerAccessReloadHook(hook: () => void): () => void {
  accessReloadHooks.add(hook);
  return () => accessReloadHooks.delete(hook);
}

export function registerHeartbeatReloadHook(hook: () => void): () => void {
  heartbeatReloadHooks.add(hook);
  return () => heartbeatReloadHooks.delete(hook);
}

function runPlatformReloadHooks(): void {
  for (const hook of platformReloadHooks) hook();
}

function runAccessReloadHooks(): void {
  for (const hook of accessReloadHooks) hook();
}

function runHeartbeatReloadHooks(): void {
  for (const hook of heartbeatReloadHooks) hook();
}

function resolveEnvFile(field: ConfigFieldDefinition): string {
  if (typeof field.envFile === "function") return field.envFile();
  return field.envFile ?? envPath(".env.local");
}

function serializeEnvValue(value: ConfigValue): string {
  if (Array.isArray(value)) return value.join(",");
  return String(value);
}

function usersJsonValue(): string {
  return JSON.stringify(config.qq.users, null, 2);
}

function applyUsersJson(raw: string): void {
  const users = parseQQUsersJson(raw);
  const identity = buildQQIdentityConfig(users, config.qq.legacyAccountWhitelist, config.qq.adminIds);
  config.qq.users = identity.users;
  config.qq.accountToUser = identity.accountToUser;
  config.qq.userWhitelist = identity.userWhitelist;
  config.qq.whitelist = identity.userWhitelist;
  config.qq.adminIds = identity.adminIds;
  config.qq.usersJsonConfigured = true;
  config.qq.usersJsonRaw = JSON.stringify(identity.users);
}

function writeEnvValue(envFile: string, key: string, value: string): void {
  const cwd = path.resolve(process.cwd());
  const target = path.resolve(cwd, envFile);
  if (!target.startsWith(cwd + path.sep)) {
    throw new Error(`env path escapes workspace: ${envFile}`);
  }

  const lines = fs.existsSync(target) ? fs.readFileSync(target, "utf-8").split(/\r?\n/) : [];
  let replaced = false;
  const nextLines = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    if (match?.[1] !== key) return line;
    replaced = true;
    return `${key}=${value}`;
  });

  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") nextLines.push("");
    nextLines.push(`${key}=${value}`);
  }

  fs.writeFileSync(target, nextLines.join("\n").replace(/\n*$/, "\n"), "utf-8");
}
