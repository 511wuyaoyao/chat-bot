/**
 * 本地前端 HTTP 服务。
 * 提供 React 面板静态资源和本地 JSON API，只监听 127.0.0.1。
 */

import express from "express";
import fs from "node:fs";
import path from "node:path";
import { config } from "../config/output";
import { logger } from "../utils/logger";
import { clearDebugTraces, debugTraceStoreStats, getDebugTrace, listDebugTraces } from "./trace-store";
import { debugPage } from "./page";
import { getDebugSessionDetail, listDebugSessions } from "./session-browser";
import { debugDetailCache } from "./detail-cache";
import {
  getDebugConfigState,
  patchDebugConfig,
  registerAccessReloadHook,
  registerHeartbeatReloadHook,
  registerPlatformReloadHook,
} from "./config-manager";

const FRONTEND_ROUTE = "/frontend";

export interface DebugServerOptions {
  onPlatformReload?: () => void;
  onAccessReload?: () => void;
  onHeartbeatReload?: () => void;
}

export function startDebugServer(options: DebugServerOptions = {}): (() => void) | null {
  if (!config.debug.enabled) return null;
  const unregisterPlatformReload = options.onPlatformReload
    ? registerPlatformReloadHook(options.onPlatformReload)
    : null;
  const unregisterAccessReload = options.onAccessReload
    ? registerAccessReloadHook(options.onAccessReload)
    : null;
  const unregisterHeartbeatReload = options.onHeartbeatReload
    ? registerHeartbeatReloadHook(options.onHeartbeatReload)
    : null;

  const app = express();
  app.use(express.json({ limit: "20mb" }));

  app.get(FRONTEND_ROUTE, (_req, res) => {
    res.type("html").send(debugPage());
  });

  app.get(`${FRONTEND_ROUTE}/assets/styles.css`, (_req, res) => {
    sendFrontendAsset(res, "styles.css", "css");
  });

  app.get(`${FRONTEND_ROUTE}/assets/client.js`, (_req, res) => {
    sendFrontendAsset(res, "client.js", "application/javascript");
  });

  app.get(`${FRONTEND_ROUTE}/traces`, (_req, res) => {
    res.json(listDebugTraces());
  });

  app.get(`${FRONTEND_ROUTE}/traces/:id`, (req, res) => {
    const trace = getDebugTrace(req.params.id);
    if (!trace) {
      res.status(404).json({ error: "trace not found" });
      return;
    }
    res.json(trace);
  });

  app.delete(`${FRONTEND_ROUTE}/traces`, (_req, res) => {
    clearDebugTraces();
    res.json({ success: true });
  });

  app.get(`${FRONTEND_ROUTE}/sessions`, (_req, res) => {
    res.json(listDebugSessions());
  });

  app.get(`${FRONTEND_ROUTE}/sessions/:personId/:sessionId/:actor`, (req, res) => {
    const detail = getDebugSessionDetail(
      req.params.personId,
      req.params.sessionId,
      req.params.actor
    );
    if (!detail) {
      res.status(404).json({ error: "session context not found" });
      return;
    }
    res.json(detail);
  });

  app.get(`${FRONTEND_ROUTE}/cache`, (_req, res) => {
    res.json({
      detail: debugDetailCache.stats(),
      trace: debugTraceStoreStats(),
    });
  });

  app.get(`${FRONTEND_ROUTE}/status`, (_req, res) => {
    const traceStats = debugTraceStoreStats();
    res.json({
      adapter: config.platform.adapter,
      uptimeSeconds: Math.round(process.uptime()),
      memoryRss: process.memoryUsage().rss,
      traceCount: traceStats.itemCount,
      trace: traceStats,
      detailCache: debugDetailCache.stats(),
    });
  });

  app.get(`${FRONTEND_ROUTE}/config`, (_req, res) => {
    res.json(getDebugConfigState());
  });

  app.patch(`${FRONTEND_ROUTE}/config`, (req, res) => {
    const values = req.body?.values;
    if (!values || typeof values !== "object" || Array.isArray(values)) {
      res.status(400).json({ success: false, errors: { _global: "请求体必须包含 values 对象" } });
      return;
    }

    const result = patchDebugConfig(values as Record<string, unknown>);
    if (!result.success) {
      res.status(400).json(result);
      return;
    }
    res.json(result);
  });

  const server = app.listen(config.debug.port, "127.0.0.1", () => {
    logger.info(`Frontend dashboard 已启动：http://127.0.0.1:${config.debug.port}${FRONTEND_ROUTE}`);
  });

  return () => {
    unregisterPlatformReload?.();
    unregisterAccessReload?.();
    unregisterHeartbeatReload?.();
    server.close();
  };
}

function sendFrontendAsset(res: express.Response, filename: string, contentType: string): void {
  const assetPath = path.resolve(process.cwd(), "dist", "debug", "frontend", "assets", filename);
  if (!assetPath.startsWith(path.resolve(process.cwd()) + path.sep) || !fs.existsSync(assetPath)) {
    res
      .status(503)
      .type("text")
      .send("Frontend assets are missing. Run npm run build first.");
    return;
  }
  res.type(contentType).sendFile(assetPath);
}
