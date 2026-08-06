/**
 * topic-agent 上下文压缩策略。
 */

import { mutateContext } from "../set";
import type { StoredMessage } from "../utils/types";
import {
  ContextCompactionReason,
  markDeleted,
  markToolTraceDeleted,
  recentIndexes,
  toolCallIds,
} from "./common";

const TOPIC_RECENT_ASSISTANT_KEEP = 6;

export type TopicContextCompactionLayer = 1 | 2 | 3 | 4;

export const TOPIC_THRESHOLDS: Record<TopicContextCompactionLayer, number> = {
  1: 4_000,
  2: 8_000,
  3: 12_000,
  4: 16_000,
};

export function compactTopicContext(
  sessionId: string,
  baseDir: string,
  layer: TopicContextCompactionLayer
): { changed: number; reason: ContextCompactionReason } {
  let changed = 0;
  mutateContext(sessionId, (messages) => {
    changed = layer === 1
      ? compactTopicLayer1(messages)
      : layer === 2
        ? compactTopicLayer2(messages)
        : layer === 3
          ? compactTopicLayer3(messages)
          : compactTopicLayer4();
    return changed > 0;
  }, baseDir);

  if (layer === 4) return { changed: 0, reason: "not_implemented" };

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

function compactTopicLayer4(): number {
  return 0;
}
