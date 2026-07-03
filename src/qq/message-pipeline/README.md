# qq/message-pipeline

QQ 消息处理流水线。入口 `index.ts` 负责按消息来源与 @ 关系分发到不同处理目录，各目录负责自己的匹配、白名单过滤和文本清洗。
