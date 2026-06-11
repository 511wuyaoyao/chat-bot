# router

消息路由层。队列负责运输调度，router 负责业务分发。

## 文件

- `message-queue.ts` — 消息队列：串行处理 + 引用中断 + 撤回 + 入队归档
- `message-router.ts` — 消息网关：指令拦截 → mainAgent → topic 入队
- `commands/` — 指令层（以 / 开头），直接执行不经过 AI
- `session/` — session 上下文持久化（context.json），供 Agent 层使用
- `archive/` — 归档持久化（archive.jsonl），供 Router 层使用

## 权限边界

```
Router 层（message-queue, message-router）
  → 只读写 router/archive/（archive.jsonl）
  → 禁止 import router/session/ 的 set/get（manage 除外）

Agent 层（agent-loop）
  → 只读写 router/session/（context.json）
  → 禁止 import router/archive/
```

上层Agent层（main/exec/topic）
禁止 import router/session/
禁止 import router/archive/
