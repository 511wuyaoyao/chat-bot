# frontend/react/components

Debug React 前端的跨页面复用展示组件目录。

## 职责

- 存放跨页面复用的轻量组件。
- 不直接请求后端 API。
- 不持有页面级业务状态。
- `MessageBlock` 负责统一渲染调试消息：
  - 有 `topic` 时显示 topic badge，没有则不显示。
  - `hideTopic` 只隐藏带 `topic` 的消息。
  - `hideDeleted` 隐藏 `deleted: true` 的压缩消息。
  - `hideTools` 隐藏工具消息，但压缩消息优先保留，除非启用 `hideDeleted`。
  - user / assistant / system / tool 用低饱和颜色区分。
