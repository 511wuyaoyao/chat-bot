# qq

QQ 平台适配层。封装与 NapCat 框架的通信。

- `adapter.ts` — QQ 适配器，基于 Express + WebSocket 接收 NapCat 事件，通过 HTTP API 发送消息。支持引用消息（reply）读取
- `connection.ts` — 连接保活：WsPing（WS 层 ping/pong）+ MsgHeartbeat（消息层心跳防空闲断连）
- `message-builder.ts` — 消息模板构建器，统一管理回复消息格式
