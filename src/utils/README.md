# utils

通用工具模块。

- `logger.ts` — 控制台 + 文件双通道日志工具
  - 控制台：带颜色标记，受 `LOG_LEVEL` 控制级别过滤
  - 文件：`data/logs/qqbot-YYYY-MM-DD.log`，始终记录所有级别（含 debug），Promise 队列串行写入
  - 轮转：按天自动切换文件
  - 清理：启动时自动删除超过 `LOG_RETENTION_DAYS`（默认 30 天）的旧文件
  - 开关：`LOG_FILE_ENABLED=false` 可关闭文件日志
