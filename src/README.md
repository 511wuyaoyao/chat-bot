# src

QQ 个人管家 Bot 源代码目录。

| 子目录 | 职责 |
|--------|------|
| `nlp/` | NL 解析层，调用 DeepSeek API 将自然语言转为结构化意图 |
| `qq/` | QQ 适配层，封装与 NapCat 框架的 WebSocket/HTTP 通信 |
| `router/` | 消息路由层，串联预分类 → NL 解析 → 意图分发流程 |
| `handlers/` | 意图处理器，执行 create / query / update / delete 等具体操作 |
| `utils/` | 通用工具（日志等） |

入口文件：`index.ts`
