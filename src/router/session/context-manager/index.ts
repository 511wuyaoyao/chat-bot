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
import { compactMainContext, MAIN_THRESHOLDS, MainContextCompactionLayer } from "./main-agent";
import { compactTopicContext, TOPIC_THRESHOLDS, TopicContextCompactionLayer } from "./topic-agent";

export { clearContextCompactionCooldownForTest } from "./common";
export type {
  ContextCompactionActor,
  ContextCompactionLayer,
} from "./common";
export type { MainContextCompactionLayer } from "./main-agent";
export type { TopicContextCompactionLayer } from "./topic-agent";

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

const MAIN_LAYERS: MainContextCompactionLayer[] = [1, 2, 3];
const TOPIC_LAYERS: TopicContextCompactionLayer[] = [1, 2, 3, 4];

export function maybeCompactContext(input: ContextCompactionInput): ContextCompactionResult {
  const actor = normalizeActor(input.actor);
  const promptTokens = promptTokensOf(input.usage);

  if (!actor) {
    return { attempted: false, changed: 0, reason: "unsupported_actor", promptTokens };
  }

  if (!input.baseDir) {
    return { attempted: false, actor, changed: 0, reason: "missing_base_dir", promptTokens };
  }

  if (actor === "main-agent") {
    return runCompactionLayers({
      input,
      actor,
      promptTokens,
      layers: MAIN_LAYERS,
      thresholdOf: (layer) => MAIN_THRESHOLDS[layer],
      runLayer: (layer) => compactMainContext(input.sessionId, input.baseDir!, layer),
    });
  }

  return runCompactionLayers({
    input,
    actor,
    promptTokens,
    layers: TOPIC_LAYERS,
    thresholdOf: (layer) => TOPIC_THRESHOLDS[layer],
    runLayer: (layer) => compactTopicContext(input.sessionId, input.baseDir!, layer),
  });
}

function runCompactionLayers<TLayer extends number>(options: {
  input: ContextCompactionInput;
  actor: ContextCompactionActor;
  promptTokens: number;
  layers: TLayer[];
  thresholdOf: (layer: TLayer) => number;
  runLayer: (layer: TLayer) => Pick<ContextCompactionResult, "changed" | "reason">;
}): ContextCompactionResult {
  const { input, actor, promptTokens, layers, thresholdOf, runLayer } = options;
  const baseDir = input.baseDir;
  if (!baseDir) {
    return { attempted: false, actor, changed: 0, reason: "missing_base_dir", promptTokens };
  }

  let sawThreshold = false;
  let sawCooldown = false;
  let sawNoCandidate = false;

  for (const layer of layers) {
    const threshold = thresholdOf(layer);
    if (promptTokens < threshold) continue;
    sawThreshold = true;

    if (!cooldownReady(baseDir, actor, layer)) {
      sawCooldown = true;
      continue;
    }

    const result = runLayer(layer);
    if (result.reason === "compacted") {
      markCooldown(baseDir, actor, layer);
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

function normalizeActor(actor: string): ContextCompactionActor | null {
  if (actor === "main-agent" || actor === "topic-agent") return actor;
  return null;
}
