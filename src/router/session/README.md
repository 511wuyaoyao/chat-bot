# session

会话上下文持久化目录。

## 存储结构

```text
data/{userId}/session/
  {userId}_{random}/
    main/
      context.json
    topic/
      context.json
    exec/
      context.json
```

topic queue 是用户级全局文件，不隶属单个 session：`data/{userId}/topic-queue.json`。

## 文件

- `get.ts`：上下文窗口构建，负责 system prompt、历史消息和 attention 注入。
- `set.ts`：上下文消息写入与元数据更新。
- `utils/types.ts`：`StoredMessage` 类型。
- `utils/storage.ts`：路径工具，支持 agent 子目录注入。
