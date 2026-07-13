/**
 * topic-agent 上下文压缩策略。
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

const TOPIC_RECENT_ASSISTANT_KEEP = 6;

export const TOPIC_THRESHOLDS: Record<ContextCompactionLayer, number> = {
  1: 4_000,
  2: 8_000,
  3: 12_000,
};

export function compactTopicContext(
  sessionId: string,
  baseDir: string,
  layer: ContextCompactionLayer
): { changed: number; reason: ContextCompactionReason } {
  let changed = 0;
  mutateContext(sessionId, (messages) => {
    changed = layer === 1
      ? compactTopicLayer1(messages)
      : layer === 2
        ? compactTopicLayer2(messages)
        : compactTopicLayer3(messages);
    return changed > 0;
  }, baseDir);

  return changed > 0
    ? { changed, reason: "compacted" }
    : { changed: 0, reason: "no_candidate" };
}

function compactTopicLayer1(messages: StoredMessage[]): number {
  let changed = 0;
  for (const msg of messages) {
    if (msg.deleted || msg.role !== "user") continue;
    changed += markDeleted(msg, "topic_user", 1);
  }
  return changed;
}

function compactTopicLayer2(messages: StoredMessage[]): number {
  return markToolTraceDeleted(messages, "topic_tool_trace", 2);
}

function compactTopicLayer3(messages: StoredMessage[]): number {
  const protectedIndexes = recentIndexes(
    messages,
    (msg) => !msg.deleted && msg.role === "assistant" && toolCallIds(msg).length === 0,
    TOPIC_RECENT_ASSISTANT_KEEP
  );

  let changed = 0;
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.deleted || protectedIndexes.has(i)) continue;
    if (msg.role !== "assistant" || toolCallIds(msg).length > 0) continue;
    if (msg.compactionHints?.topicWritten || msg.compactionHints?.dataMutated) continue;
    changed += markDeleted(msg, "topic_no_persist", 3);
  }
  return changed;
}
