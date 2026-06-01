# qq

QQ 平台适配层。封装与 NapCat 框架的通信，包括接收消息事件和发送回复消息。

- `adapter.ts` — QQ 适配器，基于 Express + WebSocket 接收 NapCat 事件，通过 HTTP API 发送消息
- `message-builder.ts` — 消息模板构建器，统一管理回复消息格式
