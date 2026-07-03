# debug

本地调试面板。仅在 `DEBUG_DASHBOARD_ENABLED=true` 时启用，用内存 ring buffer 保存最近 LLM 请求和工具事件，并同步持久化同样数量的 trace。

## 职责

- 捕获每次发给模型的完整 messages、tools 和参数。
- 捕获模型响应、错误、finish_reason 和 usage。
- 捕获同一轮请求关联的工具调用事件。
- 提供本地 HTTP 调试页面和 JSON API。

## 存储

```text
data/debug-traces.json
```

保留数量由 `DEBUG_TRACE_MAX_KEEP` 控制，默认 10 条。

## 路由

- `GET /debug`：调试页面
- `GET /debug/traces`：最近 trace 列表
- `GET /debug/traces/:id`：单条 trace 详情
- `DELETE /debug/traces`：清空内存和持久化 trace
