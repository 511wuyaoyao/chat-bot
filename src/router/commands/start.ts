/**
 * /start  /new — 创建新对话
 */

import { commandRegistry } from "./registry";
import { switchSession } from "../message-router";
import { createSessionId } from "../data-index";

const handler = async (userId: string) => {
  const sid = createSessionId(userId);
  switchSession(userId, sid);
  return "已创建新对话，旧对话已保留。";
};

commandRegistry.register({
  name: "start",
  description: "创建新对话并切换过去，旧对话保留",
  execute: handler,
});

commandRegistry.register({
  name: "new",
  description: "创建新对话并切换过去，旧对话保留",
  execute: handler,
});
