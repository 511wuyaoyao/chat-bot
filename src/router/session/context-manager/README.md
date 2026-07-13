# context-manager

上下文压缩管理模块。负责根据最近一次模型调用的 `usage.prompt_tokens`，对 `context.json` 中的消息做逻辑删除。

## 职责

- 只修改 session 层 `context.json` 中的存储字段。
- 使用 `deleted` / `deletedReason` / `deletedAt` / `compactionLayer` 做逻辑删除。
- 为 main-agent 和 topic-agent 提供不同的压缩策略。
- 用内存记录每个 agent、每层压缩的冷却时间。

## 文件

- `index.ts`：统一入口，根据 actor 分发到对应策略。
- `main-agent.ts`：main-agent 专用压缩规则。
- `topic-agent.ts`：topic-agent 专用压缩规则。
- `common.ts`：公共类型、逻辑删除工具、工具调用识别和内存冷却状态。

## 边界

- 不修改 `archive.json`。
- 不修改 `token-usage.json`。
- 不修改 `transaction-events.json`。
- 不负责生成摘要；main-agent 第三层仅预留接口。
