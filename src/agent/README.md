# agent 模块

通用 Agent 架构核心。基于 DeepSeek function calling 实现工具调用循环，AI 自主决定调用哪些工具、调用几次、根据结果调整。

## 文件

- `agent-loop.ts` — Agent 主循环：组装消息 → 调 AI → 处理 tool_calls → 循环直到 AI 回复或达到上限
- `tool-registry.ts` — 工具注册表：ToolDefinition / ToolHandler 类型，register / execute / getDefinitions 方法
- `llm-client.ts` — 共享 OpenAI 客户端（懒加载单例），供 agent-loop 和 qa-fallback 共用
- `system-prompt.ts` — Agent System Prompt 构建器：角色定义 + 工具列表（动态从 toolRegistry 注入）+ 分类指南 + 回复风格，支持预分类 hint 注入
- `qa-fallback.ts` — 兜底 QA：仅在 API 完全失败或 max iterations 耗尽时调用，不使用工具

## 设计原则

- **AI 自主决策**：不预设意图分发路径，AI 根据用户消息自行判断调用哪些工具
- **工具结果驱动**：AI 看到工具返回结果后决定下一步（继续调工具 or 回复用户）
- **循环上限保护**：最多 5 轮迭代（可配置），防止死循环
- **优雅降级**：API 异常 → 重试 → qaFallback 兜底，保证用户总能收到回复
