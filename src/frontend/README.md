# frontend

本地前端面板模块。提供 React 面板、静态资源和本地 JSON API。

## 职责

- 提供 `/frontend` 单页 HTML 外壳和 React 静态资源。
- 提供本地 JSON API：traces、sessions、status、config。
- 保存最近 LLM trace 到内存和 `data/debug-traces.json`。
- 只读浏览不同 person / session / actor 的上下文。
- 管理 Config 页的安全热更新和 env 写回。

## 文件

- `server.ts`：本地前端 HTTP server 和 JSON API。
- `page.ts`：前端页面 HTML 入口。
- `page-shell.ts`：React 应用 HTML 外壳。
- `trace-store.ts`：trace 内存与持久化存储。
- `session-browser.ts`：session context 浏览。
- `detail-cache.ts`：详情缓存。
- `config-manager.ts`：Config 字段 registry、校验、热更新和 env 写回。
- `react/`：浏览器端 React 前端源码。

## 路由

- `GET /frontend`：前端页面。
- `GET /frontend/assets/client.js`：React 前端脚本。
- `GET /frontend/assets/styles.css`：React 前端样式。
- `GET /frontend/traces`：最近 trace 列表。
- `GET /frontend/traces/:id`：单条 trace 详情。
- `DELETE /frontend/traces`：清空内存和持久化 trace。
- `GET /frontend/sessions`：person / session 列表。
- `GET /frontend/sessions/:personId/:sessionId/:actor`：单个 session actor 的 context 详情。
- `GET /frontend/status`：运行状态。
- `GET /frontend/config`：可视化配置状态。
- `PATCH /frontend/config`：保存可热更新配置。
