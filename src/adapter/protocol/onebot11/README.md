# onebot11

OneBot v11 协议接口定义目录。这里按官方文档拆分消息段、事件、API 和通信层类型，不包含 NapCat 连接、HTTP、WebSocket 或 QQ 业务过滤逻辑。

## 子目录

- `message/`：消息格式与消息段类型。
- `event/`：消息、通知、请求、元事件类型。
- `api/`：公开 action 的请求与响应类型。
- `communication/`：HTTP / WebSocket 通信载荷类型。

## 文件

- `common.ts`：通用基础类型。
- `types.ts`：兼容出口，统一 re-export 全部协议类型。
- `index.ts`：主出口。
