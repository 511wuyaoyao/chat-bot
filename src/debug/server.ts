/**
 * 本地调试 HTTP 服务
 * 提供内存 trace 的页面和 JSON API，只监听 127.0.0.1。
 */

import express from "express";
import { config } from "../config";
import { logger } from "../utils/logger";
import { clearDebugTraces, debugTraceStoreStats, getDebugTrace, listDebugTraces } from "./trace-store";
import { debugPage } from "./page";
import { getDebugSessionDetail, listDebugSessions } from "./session-browser";
import { debugDetailCache } from "./detail-cache";

export function startDebugServer(): (() => void) | null {
  if (!config.debug.enabled) return null;

  const app = express();
  app.use(express.json({ limit: "20mb" }));

  app.get("/debug", (_req, res) => {
    res.type("html").send(debugPage());
  });

  app.get("/debug/traces", (_req, res) => {
    res.json(listDebugTraces());
  });

  app.get("/debug/traces/:id", (req, res) => {
    const trace = getDebugTrace(req.params.id);
    if (!trace) {
      res.status(404).json({ error: "trace not found" });
      return;
    }
    res.json(trace);
  });

  app.delete("/debug/traces", (_req, res) => {
    clearDebugTraces();
    res.json({ success: true });
  });

  app.get("/debug/sessions", (_req, res) => {
    res.json(listDebugSessions());
  });

  app.get("/debug/sessions/:userId/:sessionId/:actor", (req, res) => {
    const detail = getDebugSessionDetail(
      req.params.userId,
      req.params.sessionId,
      req.params.actor
    );
    if (!detail) {
      res.status(404).json({ error: "session context not found" });
      return;
    }
    res.json(detail);
  });

  app.get("/debug/cache", (_req, res) => {
    res.json({
      detail: debugDetailCache.stats(),
      trace: debugTraceStoreStats(),
    });
  });

  const server = app.listen(config.debug.port, "127.0.0.1", () => {
    logger.info(`Debug dashboard 已启动：http://127.0.0.1:${config.debug.port}/debug`);
  });

  return () => server.close();
}
