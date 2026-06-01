# router

消息路由层。串联消息处理的完整流程：上下文管理 → 规则预分类 → Agent Loop（工具调用）。

- `message-router.ts` — 消息路由主入口，编排完整处理流程（→ agentLoop）
- `context-manager.ts` — 对话上下文管理器，每用户环形缓冲区保留最近 5 条消息
- `pre-classify.ts` — 规则预分类，在调用 AI 前用正则匹配快速判断意图，作为 hint 注入 system prompt
