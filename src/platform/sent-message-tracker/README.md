# platform/sent-message-tracker

Adapter 自发消息追踪目录。记录通过发送 API 成功返回的 `message_id`，用于在后续普通 `message` 回流时消费并过滤。

## 边界

- 不依赖实现端扩展事件。
- 不修改 OneBot11 协议类型。
- 只负责短期去重，不负责持久化消息记录。
