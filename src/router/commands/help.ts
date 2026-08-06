/**
 * /help — 列出所有可用指令
 */

import { messages } from "../../prompt";
import { config } from "../../config/output";
import { commandRegistry } from "./registry";

commandRegistry.register({
  name: "help",
  description: "显示所有可用指令",
  async execute(userId) {
    return config.qq.adminIds.includes(userId)
      ? messages.commands.adminHelpFull
      : messages.commands.help;
  },
});
