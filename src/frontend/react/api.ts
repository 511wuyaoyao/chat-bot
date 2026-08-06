/**
 * Frontend React API 请求封装。
 */

import type { DebugConfigState, DebugSessionDetail, DebugSessionList, DebugStatus, DebugTrace } from "./types";

const API_BASE = "/frontend";

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export const debugApi = {
  traces: () => getJson<DebugTrace[]>(`${API_BASE}/traces`),
  traceDetail: (id: string) => getJson<DebugTrace>(`${API_BASE}/traces/${encodeURIComponent(id)}`),
  clearTraces: async () => {
    const response = await fetch(`${API_BASE}/traces`, { method: "DELETE" });
    if (!response.ok) throw new Error(`clear traces failed: ${response.status}`);
  },
  sessions: () => getJson<DebugSessionList>(`${API_BASE}/sessions`),
  sessionDetail: (personId: string, sessionId: string, actor: string) =>
    getJson<DebugSessionDetail>(
      `${API_BASE}/sessions/${encodeURIComponent(personId)}/${encodeURIComponent(sessionId)}/${encodeURIComponent(actor)}`
    ),
  status: () => getJson<DebugStatus>(`${API_BASE}/status`),
  config: () => getJson<DebugConfigState>(`${API_BASE}/config`),
  patchConfig: async (values: Record<string, unknown>) => {
    const response = await fetch(`${API_BASE}/config`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ values }),
    });
    const body = (await response.json()) as DebugConfigState & {
      success?: boolean;
      errors?: Record<string, string>;
      error?: string;
    };
    if (!response.ok) {
      const error = new Error(body.error || "保存失败");
      Object.assign(error, { body });
      throw error;
    }
    return body;
  },
};
