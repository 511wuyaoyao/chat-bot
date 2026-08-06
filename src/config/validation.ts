/**
 * 启动配置校验。
 */

import { config } from "./index";

export function validateConfig(): string[] {
  const errors: string[] = [];

  if (!config.deepseek.apiKey) errors.push("DEEPSEEK_API_KEY 未设置");
  errors.push(...config.qq.identityErrors);
  if (config.qq.userWhitelist.length === 0) {
    errors.push("QQ_USERS_JSON/QQ_USER_WHITELIST 为空，机器人不会响应任何用户消息");
  }

  if (config.platform.adapter === "qqbot-official") {
    if (!config.qq.qqbot.appId) errors.push("QQBOT_APP_ID 未设置");
    if (!config.qq.qqbot.appSecret) errors.push("QQBOT_APP_SECRET 未设置");
  }

  return errors;
}
