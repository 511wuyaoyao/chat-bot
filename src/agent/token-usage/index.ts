/**
 * Token 消耗聚合
 * 按主会话记录 main/exec/topic 等 agent 的累计 token usage。
 */

import fs from "fs";
import path from "path";

const DATA_ROOT = path.resolve(process.cwd(), "data");

export interface TokenUsageBucket {
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  prompt_cache_hit_tokens: number;
  prompt_cache_miss_tokens: number;
  reasoning_tokens: number;
}

export interface TokenUsageLedger {
  sessionId: string;
  updatedAt: string;
  total: TokenUsageBucket;
  byAgent: Record<string, TokenUsageBucket>;
}

export type TokenUsagePeriod = "total" | "day" | "week" | "month";

interface DailyTokenUsageLedger {
  updatedAt: string;
  byDate: Record<string, {
    total: TokenUsageBucket;
    byUser: Record<string, TokenUsageBucket>;
    byAgent: Record<string, TokenUsageBucket>;
  }>;
}

export interface RecordTokenUsageInput {
  userId: string;
  mainSessionId: string;
  actor: string;
  usage: unknown;
}

function emptyBucket(): TokenUsageBucket {
  return {
    calls: 0,
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
    prompt_cache_hit_tokens: 0,
    prompt_cache_miss_tokens: 0,
    reasoning_tokens: 0,
  };
}

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function today(): string {
  return now().slice(0, 10);
}

function filePath(userId: string, mainSessionId: string): string {
  return path.join(DATA_ROOT, userId, "session", mainSessionId, "token-usage.json");
}

function dailyFilePath(): string {
  return path.join(DATA_ROOT, "token-usage-daily.json");
}

function load(userId: string, mainSessionId: string): TokenUsageLedger {
  const fp = filePath(userId, mainSessionId);
  if (!fs.existsSync(fp)) {
    return {
      sessionId: mainSessionId,
      updatedAt: now(),
      total: emptyBucket(),
      byAgent: {},
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf-8")) as Partial<TokenUsageLedger>;
    return {
      sessionId: data.sessionId || mainSessionId,
      updatedAt: data.updatedAt || now(),
      total: { ...emptyBucket(), ...(data.total || {}) },
      byAgent: data.byAgent || {},
    };
  } catch {
    return {
      sessionId: mainSessionId,
      updatedAt: now(),
      total: emptyBucket(),
      byAgent: {},
    };
  }
}

function save(userId: string, mainSessionId: string, ledger: TokenUsageLedger): void {
  const fp = filePath(userId, mainSessionId);
  const dir = path.dirname(fp);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2), "utf-8");
  fs.renameSync(tmp, fp);
}

function loadDaily(): DailyTokenUsageLedger {
  const fp = dailyFilePath();
  if (!fs.existsSync(fp)) {
    return { updatedAt: now(), byDate: {} };
  }

  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf-8")) as Partial<DailyTokenUsageLedger>;
    return {
      updatedAt: data.updatedAt || now(),
      byDate: data.byDate || {},
    };
  } catch {
    return { updatedAt: now(), byDate: {} };
  }
}

function saveDaily(ledger: DailyTokenUsageLedger): void {
  const fp = dailyFilePath();
  const tmp = `${fp}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(ledger, null, 2), "utf-8");
  fs.renameSync(tmp, fp);
}

function numberField(obj: Record<string, unknown>, key: string): number {
  const value = obj[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function nestedNumber(obj: Record<string, unknown>, key: string, nestedKey: string): number {
  const value = obj[key];
  if (!value || typeof value !== "object") return 0;
  return numberField(value as Record<string, unknown>, nestedKey);
}

function normalizeUsage(usage: unknown): TokenUsageBucket {
  if (!usage || typeof usage !== "object") return emptyBucket();

  const raw = usage as Record<string, unknown>;
  const promptTokens = numberField(raw, "prompt_tokens");
  const completionTokens = numberField(raw, "completion_tokens");
  const totalTokens = numberField(raw, "total_tokens") || promptTokens + completionTokens;
  const cacheHit =
    numberField(raw, "prompt_cache_hit_tokens") ||
    nestedNumber(raw, "prompt_tokens_details", "cached_tokens");
  const cacheMiss =
    numberField(raw, "prompt_cache_miss_tokens") ||
    Math.max(promptTokens - cacheHit, 0);

  return {
    calls: 1,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    prompt_cache_hit_tokens: cacheHit,
    prompt_cache_miss_tokens: cacheMiss,
    reasoning_tokens: nestedNumber(raw, "completion_tokens_details", "reasoning_tokens"),
  };
}

function addBucket(target: TokenUsageBucket, delta: TokenUsageBucket): void {
  target.calls += delta.calls;
  target.prompt_tokens += delta.prompt_tokens;
  target.completion_tokens += delta.completion_tokens;
  target.total_tokens += delta.total_tokens;
  target.prompt_cache_hit_tokens += delta.prompt_cache_hit_tokens;
  target.prompt_cache_miss_tokens += delta.prompt_cache_miss_tokens;
  target.reasoning_tokens += delta.reasoning_tokens;
}

function cloneBucket(bucket: TokenUsageBucket): TokenUsageBucket {
  return { ...emptyBucket(), ...bucket };
}

export function recordTokenUsage(input: RecordTokenUsageInput): void {
  const delta = normalizeUsage(input.usage);
  if (delta.calls === 0) return;

  const ledger = load(input.userId, input.mainSessionId);
  ledger.updatedAt = now();
  addBucket(ledger.total, delta);

  if (!ledger.byAgent[input.actor]) ledger.byAgent[input.actor] = emptyBucket();
  addBucket(ledger.byAgent[input.actor], delta);

  save(input.userId, input.mainSessionId, ledger);
  recordDailyTokenUsage(input.userId, input.actor, delta);
}

function recordDailyTokenUsage(userId: string, actor: string, delta: TokenUsageBucket): void {
  const ledger = loadDaily();
  const date = today();
  ledger.updatedAt = now();

  if (!ledger.byDate[date]) {
    ledger.byDate[date] = {
      total: emptyBucket(),
      byUser: {},
      byAgent: {},
    };
  }

  const day = ledger.byDate[date];
  addBucket(day.total, delta);

  if (!day.byUser[userId]) day.byUser[userId] = emptyBucket();
  addBucket(day.byUser[userId], delta);

  if (!day.byAgent[actor]) day.byAgent[actor] = emptyBucket();
  addBucket(day.byAgent[actor], delta);

  saveDaily(ledger);
}

export function readTokenUsage(userId: string, mainSessionId: string): TokenUsageLedger {
  return load(userId, mainSessionId);
}

export function formatTokenUsageReport(userId: string, mainSessionId: string): string {
  const ledger = readTokenUsage(userId, mainSessionId);
  const lines = [
    "当前会话 Token 消耗",
    formatBucket("总计", ledger.total),
    "",
    "按 Agent：",
  ];

  const agents = Object.entries(ledger.byAgent);
  if (agents.length === 0) {
    lines.push("暂无 token 记录");
  } else {
    for (const [actor, bucket] of agents) {
      lines.push(formatBucket(actor, bucket));
    }
  }

  return lines.join("\n");
}

export function formatGlobalTokenUsageReport(period: TokenUsagePeriod): string {
  const { title, total, byUser, byAgent, note } = globalUsage(period);
  const lines = [
    title,
    formatBucket("总计", total),
    "",
    "按用户：",
    ...formatTopBuckets(byUser),
    "",
    "按 Agent：",
    ...formatTopBuckets(byAgent),
  ];

  if (note) lines.push("", note);
  return lines.join("\n");
}

function globalUsage(period: TokenUsagePeriod): {
  title: string;
  total: TokenUsageBucket;
  byUser: Record<string, TokenUsageBucket>;
  byAgent: Record<string, TokenUsageBucket>;
  note?: string;
} {
  if (period === "total") {
    return {
      title: "全局 Token 消耗：总计",
      ...scanTotalUsage(),
    };
  }

  const days = period === "day" ? 1 : period === "week" ? 7 : 30;
  return {
    title: period === "day"
      ? "全局 Token 消耗：今天"
      : period === "week"
        ? "全局 Token 消耗：最近 7 天"
        : "全局 Token 消耗：最近 30 天",
    ...scanDailyUsage(days),
    note: "按天/周/月统计从当前版本启用后的每日账本开始累计；旧会话只计入总计。",
  };
}

function scanTotalUsage(): {
  total: TokenUsageBucket;
  byUser: Record<string, TokenUsageBucket>;
  byAgent: Record<string, TokenUsageBucket>;
} {
  const total = emptyBucket();
  const byUser: Record<string, TokenUsageBucket> = {};
  const byAgent: Record<string, TokenUsageBucket> = {};

  for (const fp of tokenUsageFiles()) {
    const userId = userIdFromTokenUsageFile(fp);
    if (!userId) continue;

    try {
      const data = JSON.parse(fs.readFileSync(fp, "utf-8")) as Partial<TokenUsageLedger>;
      const bucket = cloneBucket(data.total || emptyBucket());
      addBucket(total, bucket);

      if (!byUser[userId]) byUser[userId] = emptyBucket();
      addBucket(byUser[userId], bucket);

      for (const [actor, actorBucket] of Object.entries(data.byAgent || {})) {
        if (!byAgent[actor]) byAgent[actor] = emptyBucket();
        addBucket(byAgent[actor], cloneBucket(actorBucket));
      }
    } catch {
      // 忽略损坏的统计文件。
    }
  }

  return { total, byUser, byAgent };
}

function scanDailyUsage(days: number): {
  total: TokenUsageBucket;
  byUser: Record<string, TokenUsageBucket>;
  byAgent: Record<string, TokenUsageBucket>;
} {
  const ledger = loadDaily();
  const allowedDates = new Set(recentDates(days));
  const total = emptyBucket();
  const byUser: Record<string, TokenUsageBucket> = {};
  const byAgent: Record<string, TokenUsageBucket> = {};

  for (const [date, day] of Object.entries(ledger.byDate)) {
    if (!allowedDates.has(date)) continue;
    addBucket(total, cloneBucket(day.total));

    for (const [userId, bucket] of Object.entries(day.byUser || {})) {
      if (!byUser[userId]) byUser[userId] = emptyBucket();
      addBucket(byUser[userId], cloneBucket(bucket));
    }

    for (const [actor, bucket] of Object.entries(day.byAgent || {})) {
      if (!byAgent[actor]) byAgent[actor] = emptyBucket();
      addBucket(byAgent[actor], cloneBucket(bucket));
    }
  }

  return { total, byUser, byAgent };
}

function tokenUsageFiles(): string[] {
  const result: string[] = [];
  if (!fs.existsSync(DATA_ROOT)) return result;

  for (const user of fs.readdirSync(DATA_ROOT, { withFileTypes: true })) {
    if (!user.isDirectory() || !/^\d+$/.test(user.name)) continue;
    const sessionDir = path.join(DATA_ROOT, user.name, "session");
    if (!fs.existsSync(sessionDir)) continue;

    for (const session of fs.readdirSync(sessionDir, { withFileTypes: true })) {
      if (!session.isDirectory()) continue;
      const fp = path.join(sessionDir, session.name, "token-usage.json");
      if (fs.existsSync(fp)) result.push(fp);
    }
  }

  return result;
}

function userIdFromTokenUsageFile(fp: string): string | null {
  const relative = path.relative(DATA_ROOT, fp);
  const [userId] = relative.split(path.sep);
  return /^[A-Za-z0-9_-]{1,128}$/.test(userId) ? userId : null;
}

function recentDates(days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function formatTopBuckets(buckets: Record<string, TokenUsageBucket>): string[] {
  const entries = Object.entries(buckets)
    .sort((a, b) => b[1].total_tokens - a[1].total_tokens);
  if (entries.length === 0) return ["暂无 token 记录"];

  return entries.map(([label, bucket]) =>
    `${label}：${bucket.calls} 次 / ${formatNumber(bucket.total_tokens)} tokens`
  );
}

function formatBucket(label: string, bucket: TokenUsageBucket): string {
  return [
    `${label}：${bucket.calls} 次 / ${formatNumber(bucket.total_tokens)} tokens`,
    `输入 ${formatNumber(bucket.prompt_tokens)}｜输出 ${formatNumber(bucket.completion_tokens)}｜缓存命中 ${formatNumber(bucket.prompt_cache_hit_tokens)}｜未命中 ${formatNumber(bucket.prompt_cache_miss_tokens)}｜推理 ${formatNumber(bucket.reasoning_tokens)}`,
  ].join("\n");
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("en-US");
}
