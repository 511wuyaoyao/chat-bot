# session

会话上下文持久化。

## 存储结构

```
data/{userId}/session/
  {userId}_main_{ts}/              ← 主 Agent 会话
    context.json                    ← 上下文历史（system/user/assistant）
    archive.jsonl                   ← 审计日志（完整事件流，只追加）
    topic-queue.json                ← 话题队列
    exec/{ts}/                      ← 执行 Agent 子会话
      context.json
      archive.jsonl
  {userId}_main_{ts}_topic/         ← Topic Agent 会话（复用）
    context.json
    archive.jsonl
```

## 文件

- `get.ts` — 上下文窗口构建（system prompt + 历史 + attention 注入）
- `set.ts` — 消息写入（context + archive 双写），导出 `archiveOnly` 供队列提前归档
- `create.ts` — 会话初始化
- `archive/archive-store.ts` — archive.jsonl 读写
- `utils/types.ts` — StoredMessage 类型
- `utils/storage.ts` — 路径工具 + `overrideSessionDir`（exec-agent 目录注入）
- `utils/system-prompt.ts` — 默认 system prompt 构建（checker 旧路径使用）
