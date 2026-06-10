/**
 * /help — 列出所有可用指令
 */

import { commandRegistry } from "./registry";

commandRegistry.register({
  name: "help",
  description: "显示所有可用指令",
  async execute() {
    const cmds = commandRegistry.list();
    const lines = cmds.map((c) => `  /${c.name} — ${c.description}`);
    return `可用指令：\n${lines.join("\n")}\n\n直接输入内容即可对话。`;
  },
});
