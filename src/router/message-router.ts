/**
 * 消息路由主入口
 * 指令拦截 → agent loop
 */

import { QqMessage } from "../qq/adapter";
import { agentLoop, ProgressCallback } from "../agent/agent-loop";
import { logger } from "../utils/logger";
import { commandRegistry } from "./commands/registry";
import { create } from "./session/create";

import "./commands/help";
import "./commands/start";

const userSession = new Map<string, string>(); // userId → sessionId

function sessionId(userId: string): string {
  let sid = userSession.get(userId);
  if (!sid) {
    sid = `${userId}_${Date.now()}`;
    userSession.set(userId, sid);
    create(sid, userId);
  }
  return sid;
}

/** 切换会话（供 /start /new 指令使用） */
export function switchSession(userId: string, sid: string): void {
  userSession.set(userId, sid);
}

export async function routeMessage(
  msg: QqMessage,
  onProgress?: ProgressCallback
): Promise<string | null> {
  const userId = String(msg.user_id);
  const raw = msg.raw_message;

  if (!raw) return null;

  // 指令匹配
  const cmd = commandRegistry.match(raw);
  if (cmd) {
    logger.debug("指令执行", { userId, command: cmd.handler.name });
    return cmd.handler.execute(userId, cmd.args);
  }

  // Agent Loop
  const sid = sessionId(userId);
  return agentLoop(sid, userId, raw.trim(), onProgress);
}
