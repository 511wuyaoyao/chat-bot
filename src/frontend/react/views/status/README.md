# views/status

Status 页面负责展示前端 server 和运行时状态。

## 职责

- 加载和轮询 `GET /frontend/status`。
- 管理当前页面 toolbar。
- 展示 adapter、uptime、memory、trace count。
- 展示完整 status JSON。

## 私有状态

- status 数据。
- 页面加载错误。

## 边界

- 不把刷新和轮询逻辑上移到 `App.tsx`。
- 不编辑任何配置。
- 不承担健康检查之外的业务诊断 UI。
