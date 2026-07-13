/**
 * 上下文压缩公共工具：层级类型、逻辑删除、工具调用识别和冷却状态。
 */

import path from "path";
import type { StoredMessage } from "../utils/types";
import { nowISO } from "../../../utils/time-utils";

export type ContextCompactionActor = "main-agent" | "topic-agent";
export type ContextCompactionLayer = 1 | 2 | 3;

export type ContextCompactionReason =
  | "unsupported_actor"
  | "missing_base_dir"
  | "below_threshold"
  | "cooldown"
  | "no_candidate"
  | "compacted"
  | "not_implemented";

const COOLDOWN_MS = 15 * 60 * 1000;
const cooldown = new Map<string, number>();

export function markDeleted(
  msg: StoredMessage,
  reason: NonNullable<StoredMessage["deletedReason"]>,
  layer: ContextCompactionLayer
): number {
  if (msg.deleted) return 0;
  msg.deleted = true;
  msg.deletedReason = reason;
  msg.deletedAt = `${nowISO()} 北京时间`;
  msg.compactionLayer = layer;
  return 1;
}

export function markToolTraceDeleted(
  messages: StoredMessage[],
  reason: NonNullable<StoredMessage["deletedReason"]>,
  layer: ContextCompactionLayer
): number {
  let changed = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.deleted || msg.role !== "assistant" || toolCallIds(msg).length === 0) continue;

    changed += markDeleted(msg, reason, layer);
    let cursor = i + 1;
    while (cursor < messages.length && messages[cursor].role === "tool") {
      changed += markDeleted(messages[cursor], reason, layer);
      cursor++;
    }
  }
  return changed;
}

export function recentIndexes(
  messages: StoredMessage[],
  predicate: (msg: StoredMessage) => boolean,
  keep: number
): Set<number> {
  const indexes: number[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    if (!predicate(messages[i])) continue;
    indexes.push(i);
    if (indexes.length >= keep) break;
  }
  return new Set(indexes);
}

export function toolCallIds(msg: StoredMessage): string[] {
  if (msg.role !== "assistant" || !Array.isArray(msg.tool_calls)) return [];
  return msg.tool_calls
    .map((tc) => (tc as { id?: unknown }).id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function promptTokensOf(usage: unknown): number {
  if (!usage || typeof usage !== "object") return 0;
  const value = (usage as Record<string, unknown>).prompt_tokens;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function cooldownReady(baseDir: string, actor: ContextCompactionActor, layer: ContextCompactionLayer): boolean {
  const last = cooldown.get(cooldownKey(baseDir, actor, layer));
  return last === undefined || Date.now() - last >= COOLDOWN_MS;
}

export function markCooldown(baseDir: string, actor: ContextCompactionActor, layer: ContextCompactionLayer): void {
  cooldown.set(cooldownKey(baseDir, actor, layer), Date.now());
}

export function clearContextCompactionCooldownForTest(): void {
  cooldown.clear();
}

function cooldownKey(baseDir: string, actor: ContextCompactionActor, layer: ContextCompactionLayer): string {
  return `${path.resolve(baseDir)}::${actor}::${layer}`;
}
