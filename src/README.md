# src

QQ 个人管家 Bot 源代码目录。

| 子目录 | 职责 |
|---|---|
| `agent/` | 多 Agent 架构（main/exec/topic）+ 注意力层 + 通用循环引擎 |
| `qq/` | QQ 适配层，封装与 NapCat 框架的 WebSocket/HTTP 通信 |
| `router/` | 消息路由层：队列运输 + 业务分发 |
| `tools/` | 全局工具目录（data/schedule/topic/search），Agent 按需选配 |
| `scheduler/` | 主动消息调度（定时任务 check） |
| `utils/` | 通用工具（日志、时间、模糊匹配） |

入口文件：`index.ts`（纯接线）
