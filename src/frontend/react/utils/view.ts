/**
 * Debug React 前端通用展示格式化工具。
 */

import type { DebugMessage, DebugView } from "../types";

export function viewLabel(view: DebugView): string {
  if (view === "traces") return "Traces";
  if (view === "sessions") return "Sessions";
  if (view === "status") return "Status";
  return "Config";
}

export function messageContent(message: DebugMessage): string {
  if (Array.isArray(message.content)) {
    return message.content.map((part) => part.type === "text" ? part.text || "" : JSON.stringify(part)).join("\n");
  }
  return String(message.content || "");
}

export function formatTime(value?: string | number | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export function formatBytes(value?: number): string {
  const bytes = Number(value || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function shortSessionId(value: string): string {
  return value.replace(/^session-/, "");
}

