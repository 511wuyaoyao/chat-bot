# session

会话上下文持久化目录。

## 存储结构

```text
data/{personId}/session/
  {personId}_{random}/
    main/
      context.json
    topic/
      context.json
    exec/
      context.json
```

`personId` 是系统内部长期身份 ID，不是平台账号 ID。平台账号 ID / openid 应保留在消息入参字段里，不能作为 data 根目录语义使用。

topic queue 是 person 级全局文件，不隶属单个 session：

```text
data/{personId}/topic-queue.json
```

## 文件

- `get.ts`：上下文窗口构建，负责 system prompt、历史消息和 attention 注入。
- `set.ts`：上下文消息写入与元数据更新。
- `utils/types.ts`：`StoredMessage` 类型。
- `utils/storage.ts`：路径工具，支持 agent 子目录注入。
