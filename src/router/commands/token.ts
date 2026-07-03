/**
 * /token — 查看当前会话 Token 累计消耗
 */

import { formatTokenUsageReport } from "../../agent/token-usage";
import { getOrCreateSession } from "../data-index";
import { commandRegistry } from "./registry";

commandRegistry.register({
  name: "token",
  description: "查看当前会话 Token 消耗",
  async execute(userId) {
    const sessionId = getOrCreateSession(userId);
    return formatTokenUsageReport(userId, sessionId);
  },
});
