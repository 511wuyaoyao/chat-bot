# session

会话上下文持久化。

## 存储结构

```
data/{userId}/session/
  {userId}_{random}/                ← 会话根目录
    archive.json                    ← 审计日志
    topic-queue.json                ← 话题队列
    main/
      context.json
    topic/
      context.json
    exec/
      context.json
```

## 文件

- `get.ts` — 上下文窗口构建（system prompt + 历史 + attention 注入）
- `set.ts` — 消息写入（context.json）
- `utils/types.ts` — StoredMessage 类型
- `utils/storage.ts` — 路径工具，支持 agent 子目录注入
- `utils/system-prompt.ts` — 默认 system prompt 构建（checker 旧路径使用）
