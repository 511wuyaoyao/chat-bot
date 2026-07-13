# napcat-to-onebot

NapCat 到 OneBot11 的实现适配目录。

## 职责

- 将 NapCat 原始 WebSocket 事件整理为 OneBot11 协议事件。
- 将 OneBot11 action 请求转发到 NapCat HTTP API。
- 对外只暴露 OneBot11 运行接口实现，不暴露项目内部消息模型或转换层工具。

## 公共入口

- `index.ts`：导出 `createOneBot11Adapter` 和 OneBot11 接口类型。
- `adapter.ts`：NapCat 驱动的 OneBot11 运行实现。
- `to-onebot11.ts`：实现内部使用的事件转换。
- `connection.ts`：实现内部使用的 WebSocket 保活。
