## 开发约定

- 所有代码文件顶部必须有中文注释说明该文件功能
- 每个 src 子文件夹必须有 README.md 说明该文件夹职责，每次读取，修改前阅读 README，或者修改README
- 迭代开发，当前迭代四：多 Agent 架构（main / exec / topic）+ 消息队列 + 注意力层 + 话题系统
- 使用 `logger` 统一日志，不要用 `console.log`
- 配置通过 `src/config.ts` 集中管理，环境变量在 `.env` 中设置
- **所有用户可见文案**集中到 `src/messages.ts`，禁止硬编码
- 每次写代码前先阅读对应文件夹的 README.md

## 架构概览

```
index.ts  →  MessageQueue  →  message-router
                                  ├─ mainAgent（对话 + 路由）
                                  │    └─ delegate → execAgent（执行）
                                  ├─ topicAgent（静默提炼）
                                  └─ attention/（目录树+时间+话题队列）
```

- Agent 工具从全局 toolRegistry 按名选配，各选各的
- 会话归档双轨：archive 入队即记 / context 只存干净对话
- WS ping + 消息心跳统一在 `qq/connection.ts`
