# scheduler

主动调度目录，负责按 personId 轮询定时任务并把到期任务转换成内部私聊消息入队。

## 职责

- `proactive.ts`：按当前 `config.qq.users` 启动每个 person 的定时任务轮询。
- 身份配置热更新后，上层会停止旧轮询并重新调用 `startProactive`，避免新增 person 无轮询、删除 person 仍轮询。

## 约定

- 定时任务归档使用内部 `personId`，不使用外部平台账号 ID。
- 主动消息只构造内部消息；实际发送目标由 `Platform` 按该 person 的 `primaryAccount` 解析。
