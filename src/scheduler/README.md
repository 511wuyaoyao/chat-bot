# scheduler 模块

定时调度器，负责提醒、重复任务、过期检测、兴趣衰减和每日汇总。

## 文件

- `scheduler.ts` — 主循环：start / stop / stopAll，管理所有定时器
- `reminder.ts` — 提醒检查（15s 轮询）
- `recurring.ts` — 重复任务生成（5min 轮询）
- `expiry.ts` — 过期检测（1h 轮询）
- `decay.ts` — 兴趣衰减（24h 轮询）
- `daily-summary.ts` — 每日汇总（每分钟检查，09:00~09:05 窗口推送）

## 调度器 SendFn

调度器通过闭包注入 `SendFn`，不直接依赖 QQ adapter。
