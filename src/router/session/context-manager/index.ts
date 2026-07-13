/**
 * 上下文压缩管理入口：根据 actor 分发到 main-agent 或 topic-agent 策略。
 */

import { logger } from "../../../utils/logger";
import {
  clearContextCompactionCooldownForTest,
  ContextCompactionActor,
  ContextCompactionLayer,
  ContextCompactionReason,
  cooldownReady,
  markCooldown,
  promptTokensOf,
} from "./common";
import { compactMainContext, MAIN_THRESHOLDS } from "./main-agent";
import { compactTopicContext, TOPIC_THRESHOLDS } from "./topic-agent";

export { clearContextCompactionCooldownForTest } from "./common";
export type { ContextCompactionActor, ContextCompactionLayer } from "./common";

export interface ContextCompactionInput {
  sessionId: string;
  actor: string;
  usage: unknown;
  baseDir?: string;
}

export interface ContextCompactionResult {
  attempted: boolean;
  actor?: ContextCompactionActor;
  layer?: ContextCompactionLayer;
  changed: number;
  reason: ContextCompactionReason;
  promptTokens: number;
}

export function maybeCompactContext(input: ContextCompactionInput): ContextCompactionResult {
  const actor = normalizeActor(input.actor);
  const promptTokens = promptTokensOf(input.usage);

  if (!actor) {
    return { attempted: false, changed: 0, reason: "unsupported_actor", promptTokens };
  }

  if (!input.baseDir) {
    return { attempted: false, actor, changed: 0, reason: "missing_base_dir", promptTokens };
  }

  const thresholds = actor === "main-agent" ? MAIN_THRESHOLDS : TOPIC_THRESHOLDS;
  const layers: ContextCompactionLayer[] = actor === "main-agent" ? [1, 2, 3] : [1, 2, 3];
  let sawThreshold = false;
  let sawCooldown = false;
  let sawNoCandidate = false;

  for (const layer of layers) {
    if (promptTokens < thresholds[layer]) continue;
    sawThreshold = true;

    if (!cooldownReady(input.baseDir, actor, layer)) {
      sawCooldown = true;
      continue;
    }

    const result = runLayer(input.sessionId, input.baseDir, actor, layer);
    if (result.reason === "compacted") {
      markCooldown(input.baseDir, actor, layer);
      logger.debug("上下文压缩完成", {
        sessionId: input.sessionId,
        actor,
        layer,
        changed: result.changed,
        promptTokens,
      });
      return { attempted: true, actor, layer, changed: result.changed, reason: "compacted", promptTokens };
    }

    if (result.reason === "not_implemented") {
      return { attempted: true, actor, layer, changed: 0, reason: "not_implemented", promptTokens };
    }

    sawNoCandidate = true;
  }

  if (!sawThreshold) return { attempted: false, actor, changed: 0, reason: "below_threshold", promptTokens };
  if (sawNoCandidate) return { attempted: true, actor, changed: 0, reason: "no_candidate", promptTokens };
  if (sawCooldown) return { attempted: true, actor, changed: 0, reason: "cooldown", promptTokens };
  return { attempted: true, actor, changed: 0, reason: "no_candidate", promptTokens };
}

function runLayer(
  sessionId: string,
  baseDir: string,
  actor: ContextCompactionActor,
  layer: ContextCompactionLayer
): Pick<ContextCompactionResult, "changed" | "reason"> {
  if (actor === "main-agent") return compactMainContext(sessionId, baseDir, layer);
  return compactTopicContext(sessionId, baseDir, layer);
}

function normalizeActor(actor: string): ContextCompactionActor | null {
  if (actor === "main-agent" || actor === "topic-agent") return actor;
  return null;
}
