/**
 * main-agent 上下文压缩策略。
 */

import { mutateContext } from "../set";
import type { StoredMessage } from "../utils/types";
import {
  ContextCompactionLayer,
  ContextCompactionReason,
  markDeleted,
  markToolTraceDeleted,
  recentIndexes,
  toolCallIds,
} from "./common";

const MAIN_RECENT_KEEP = 6;

export const MAIN_THRESHOLDS: Record<ContextCompactionLayer, number> = {
  1: 8_000,
  2: 16_000,
  3: 24_000,
};

export function compactMainContext(
  sessionId: string,
  baseDir: string,
  layer: ContextCompactionLayer
): { changed: number; reason: ContextCompactionReason } {
  if (layer === 3) return compactMainLayer3();

  let changed = 0;
  mutateContext(sessionId, (messages) => {
    changed = layer === 1
      ? compactMainLayer1(messages)
      : compactMainLayer2(messages);
    return changed > 0;
  }, baseDir);

  return changed > 0
    ? { changed, reason: "compacted" }
    : { changed: 0, reason: "no_candidate" };
}

function compactMainLayer1(messages: StoredMessage[]): number {
  return markToolTraceDeleted(messages, "main_tool_trace", 1);
}

function compactMainLayer2(messages: StoredMessage[]): number {
  const protectedIndexes = recentIndexes(
    messages,
    (msg) => !msg.deleted && msg.role !== "system" && msg.role !== "tool" && toolCallIds(msg).length === 0,
    MAIN_RECENT_KEEP
  );

  let changed = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.deleted || protectedIndexes.has(i)) continue;
    if (msg.role === "system" || msg.role === "tool") continue;
    if (toolCallIds(msg).length > 0) continue;
    if (msg.topic?.trim()) continue;
    changed += markDeleted(msg, "main_no_topic", 2);
  }
  return changed;
}

function compactMainLayer3(): { changed: number; reason: ContextCompactionReason } {
  return { changed: 0, reason: "not_implemented" };
}
