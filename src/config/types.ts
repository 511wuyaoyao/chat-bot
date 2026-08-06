/**
 * 项目配置类型定义。
 */

export type PlatformAdapter = "napcat" | "qqbot-official";
export type QQBotTransport = "websocket" | "webhook";
export type AgentThinkMode = "non-thinking" | "thinking" | "thinking_max";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface QQUserAccount {
  platform: PlatformAdapter;
  id: string;
  label?: string;
}

export interface QQUserConfig {
  id: string;
  name?: string;
  accounts: QQUserAccount[];
  primaryAccount: QQUserAccount;
  fields: Record<string, unknown>;
}

export type AgentModelConfig = {
  model: string;
  temperature: number;
  maxTokens: number;
  maxIterations: number;
};
