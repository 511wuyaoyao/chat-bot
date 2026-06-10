# session

会话上下文持久化。对外只暴露两个函数：

```
get(userId, sessionId, userText) → StoredMessage[]   // 构建完整上下文窗口
set(sessionId, msg) → void                            // 存入消息 + 归档
```

生命周期：`getSession` / `newSession`（通过 `set.ts` 导出）。

## 存储结构

```
data/{userId}/session/{sessionId}/
├── context.json     ← 上下文历史（user/assistant/tool）
└── archive.jsonl    ← 审计日志（完整事件流，只追加）
```

## 内部分层

```
get.ts          ← 上下文窗口构建（system prompt + 历史 + 目录树 + 时间）
set.ts          ← 消息写入 + 会话生命周期（userId→sessionId）
archive/
  archive-store.ts  ← archive.jsonl 读写
types.ts        ← StoredMessage, ArchiveEntry
storage.ts      ← 路径工具（共享）
system-prompt.ts ← buildSystemPrompt（get.ts 调用）
tree-context.ts ← buildTreeContext（get.ts 调用）
```
