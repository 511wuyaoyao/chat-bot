/**
 * 项目配置组合与公共出口。
 */

import "./env";
import { agentConfig, execAgentConfig, mainAgentConfig, topicAgentConfig } from "./agent";
import { platformConfig, qqConfig } from "./platform";
import { debugConfig, logConfig } from "./runtime";
import { serviceConfig } from "./services";

export const config = {
  ...serviceConfig,
  platform: platformConfig,
  qq: qqConfig,
  agent: agentConfig,
  main: mainAgentConfig,
  topic: topicAgentConfig,
  exec: execAgentConfig,
  log: logConfig,
  debug: debugConfig,
};

export type { AgentModelConfig, PlatformAdapter, QQBotTransport, QQUserAccount, QQUserConfig } from "./types";
export { validateConfig } from "./validation";
