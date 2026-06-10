/**
 * /start  /new — 创建新对话
 */

import { commandRegistry } from "./registry";
import { create } from "../session/create";
import { switchSession } from "../message-router";

const handler = async (userId: string) => {
  const sid = `${userId}_${Date.now()}`;
  create(sid, userId);
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
