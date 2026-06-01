## 开发约定

- 所有代码文件顶部必须有中文注释说明该文件功能
- 每个 src 子文件夹必须有 README.md 说明该文件夹职责
- 迭代开发，当前迭代三已完成（通用 Agent 架构 + Tools Call + Web Search + 上下文持久化 + 进度消息撤回 + 文案集中管理），迭代四待定
- 使用 `logger` 统一日志，不要用 `console.log`
- 配置通过 `src/config.ts` 集中管理，环境变量在 `.env` 中设置
- **所有用户可见文案**（system prompt、进度消息、兜底回复、工具使用指南等中文字符串）**必须集中到 `src/messages.ts`**，禁止在代码中硬编码。新增工具或调整 Bot 风格时，先改 `messages.ts`
- 每次书写代码之前先阅读对应文件夹的 README.md
