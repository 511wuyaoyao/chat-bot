# debug

本地调试面板。仅在 `DEBUG_DASHBOARD_ENABLED=true` 时启用，用内存 ring buffer 保存最近 LLM 请求和工具事件，并同步持久化同样数量的 trace。

## 职责

- 捕获每次发给模型的完整 messages、tools 和参数。
- 捕获模型响应、错误、finish_reason 和 usage。
- 捕获同一轮请求关联的工具调用事件。
- 只读浏览不同用户的 session context，快速查看 main/topic/exec 上下文。
- 对已打开的详情使用按总字节限制的 LRU 缓存，避免长历史无限常驻内存。
- 提供 Status 页面查看 debug 详情缓存和 trace store 的内存预算占用。
- 提供本地 HTTP 调试页面和 JSON API。

## 存储

```text
data/debug-traces.json
```

保留数量由 `DEBUG_TRACE_MAX_KEEP` 控制，默认 10 条。
trace 内存总量由 `DEBUG_TRACE_MAX_BYTES` 控制，默认 64MB。
详情缓存总量由 `DEBUG_DETAIL_CACHE_MAX_BYTES` 控制，默认 64MB。

## 路由

- `GET /debug`：调试页面
- `GET /debug/traces`：最近 trace 列表
- `GET /debug/traces/:id`：单条 trace 详情
- `DELETE /debug/traces`：清空内存和持久化 trace
- `GET /debug/sessions`：用户 session 列表
- `GET /debug/sessions/:userId/:sessionId/:actor`：单个 session actor 的 context 详情
- `GET /debug/cache`：查看 debug 详情缓存和 trace store 占用
