/**
 * Agent 模型参数配置。
 */

import { parseNumber } from "./parsers";
import type { AgentModelConfig, AgentThinkMode } from "./types";

function parseAgentThinkMode(value: string | undefined): AgentThinkMode {
  if (value === "thinking" || value === "thinking_max") return value;
  return "non-thinking";
}

function buildAgentModelConfig(
  prefix: "MAIN" | "TOPIC" | "EXEC",
  fallback: AgentModelConfig
): AgentModelConfig {
  return {
    model: process.env[`${prefix}_MODEL`] || fallback.model,
    temperature: parseNumber(process.env[`${prefix}_TEMPERATURE`], fallback.temperature),
    maxTokens: parseNumber(process.env[`${prefix}_MAX_TOKENS`], fallback.maxTokens),
    maxIterations: parseNumber(process.env[`${prefix}_MAX_ITERATIONS`], fallback.maxIterations),
  };
}

export const defaultAgentModelConfig: AgentModelConfig = {
  model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
  temperature: parseNumber(process.env.AGENT_TEMPERATURE, 0.3),
  maxTokens: parseNumber(process.env.AGENT_MAX_TOKENS, 1024),
  maxIterations: parseNumber(process.env.AGENT_MAX_ITERATIONS, 5),
};

export const agentConfig = {
  maxIterations: defaultAgentModelConfig.maxIterations,
  thinkMode: parseAgentThinkMode(process.env.AGENT_THINK_MODE),
  maxToolResultChars: parseNumber(process.env.AGENT_TOOL_RESULT_MAX_CHARS, 1500),
  temperature: defaultAgentModelConfig.temperature,
  maxTokens: defaultAgentModelConfig.maxTokens,
  contextMaxMessages: parseNumber(process.env.AGENT_CONTEXT_MAX_MESSAGES, 24),
  contextMaxChars: parseNumber(process.env.AGENT_CONTEXT_MAX_CHARS, 24000),
  transactionEventMaxKeep: parseNumber(process.env.AGENT_TRANSACTION_EVENT_MAX_KEEP, 20),
  transactionEventAttentionLimit: parseNumber(process.env.AGENT_TRANSACTION_EVENT_ATTENTION_LIMIT, 3),
};

export const mainAgentConfig = buildAgentModelConfig("MAIN", defaultAgentModelConfig);

export const topicAgentConfig = buildAgentModelConfig("TOPIC", defaultAgentModelConfig);

export const execAgentConfig = buildAgentModelConfig("EXEC", {
  ...defaultAgentModelConfig,
  maxIterations: parseNumber(process.env.AGENT_MAX_ITERATIONS, 8),
});
