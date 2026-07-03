# transaction-event

Agent 事务事件系统。`TransactionEvent` 是 Agent 运行过程中产生的统一事件模型，同时用于运行期监听和持久化回执。

## 文件

- `event.ts`：定义 `TransactionEvent`，提供 `emitTransactionEvent` / `onTransactionEvent`。
- `listener.ts`：监听并持久化需要保留的事件，向 attention 提供最近事件摘要。
- `index.ts`：统一导出，并确保 listener 被加载。

## 存储

```text
data/{userId}/session/{mainSessionId}/transaction-events.json
```
