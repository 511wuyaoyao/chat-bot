/**
 * 调试 Trace 存储
 * 内存保留最近有限条 LLM 请求，并同步持久化同样数量的 trace。
 */

import fs from "fs";
import path from "path";
import { config } from "../config";

export interface DebugTraceEvent {
  type: string;
  createdAt: string;
  data?: unknown;
}

export interface DebugTrace {
  id: string;
  createdAt: string;
  updatedAt: string;
  actor: string;
  userId: string;
  sessionId: string;
  mainSessionId: string;
  round: number;
  model: string;
  params: Record<string, unknown>;
  messages: unknown[];
  tools?: unknown[];
  status: "pending" | "completed" | "failed";
  response?: unknown;
  error?: string;
  finishReason?: string | null;
  usage?: unknown;
  events: DebugTraceEvent[];
}

const DATA_ROOT = path.resolve(process.cwd(), "data");
const TRACE_FILE = path.join(DATA_ROOT, "debug-traces.json");

const traces: DebugTrace[] = loadPersistedTraces();

function now(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function keepCount(): number {
  return Math.max(1, config.debug.traceMaxKeep);
}

function trim(): void {
  const keep = keepCount();
  if (traces.length > keep) traces.splice(0, traces.length - keep);
}

function loadPersistedTraces(): DebugTrace[] {
  if (!fs.existsSync(TRACE_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(TRACE_FILE, "utf-8"));
    return Array.isArray(data) ? data.slice(-keepCount()) : [];
  } catch {
    return [];
  }
}

function persist(): void {
  try {
    trim();
    if (!fs.existsSync(DATA_ROOT)) fs.mkdirSync(DATA_ROOT, { recursive: true });
    const tmp = `${TRACE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(traces, null, 2), "utf-8");
    fs.renameSync(tmp, TRACE_FILE);
  } catch {
    // debug trace 不能影响主业务链路。
  }
}

export function createDebugTrace(input: Omit<DebugTrace, "id" | "createdAt" | "updatedAt" | "status" | "events">): string | null {
  if (!config.debug.enabled) return null;

  const createdAt = now();
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  traces.push({
    ...input,
    id,
    createdAt,
    updatedAt: createdAt,
    status: "pending",
    events: [],
  });
  trim();
  persist();
  return id;
}

export function finishDebugTrace(
  id: string | null,
  patch: Pick<Partial<DebugTrace>, "response" | "error" | "finishReason" | "usage" | "status">
): void {
  if (!id || !config.debug.enabled) return;
  const trace = traces.find((item) => item.id === id);
  if (!trace) return;
  Object.assign(trace, patch, { updatedAt: now() });
  persist();
}

export function addDebugTraceEvent(id: string | null, type: string, data?: unknown): void {
  if (!id || !config.debug.enabled) return;
  const trace = traces.find((item) => item.id === id);
  if (!trace) return;
  trace.events.push({ type, data, createdAt: now() });
  trace.updatedAt = now();
  persist();
}

export function listDebugTraces(): Array<Omit<DebugTrace, "messages" | "tools" | "response">> {
  return traces
    .slice()
    .reverse()
    .map(({ messages: _messages, tools: _tools, response: _response, ...summary }) => summary);
}

export function getDebugTrace(id: string): DebugTrace | null {
  return traces.find((item) => item.id === id) || null;
}

export function clearDebugTraces(): void {
  traces.splice(0, traces.length);
  persist();
}
