# router

消息路由层。在消息进入 LLM 之前做拦截和分发。

- `message-router.ts` — 主入口：指令拦截 → agent loop
- `context-manager.ts` — 对话上下文管理器，双层持久化（archive + working）
- `commands/` — 指令层（以 / 开头），直接执行不经过 AI
  - `registry.ts` — 指令注册表
  - `help.ts` — /help
  - `start.ts` — /开启
