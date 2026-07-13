# router

消息路由层。队列负责运输调度，router 负责业务分发。

## 文件

- `input.ts`：router 目录允许接收的入参类型边界。
- `output.ts`：router 目录允许输出的结果类型边界。
- `message-queue.ts`：消息队列，负责串行处理、引用中断、撤回和入队归档。
- `message-router.ts`：消息网关，负责命令拦截、main-agent 调用和 topic 入队。
- `commands/`：命令层，直接执行 `/` 开头的命令，不经过 AI。
- `session/`：session 上下文持久化，供 Agent 层使用。
- `archive/`：archive 持久化，供 Router 层使用。

## 权限边界

Router 层可以读写 `router/archive/`，但禁止直接操作 `router/session/` 的底层 set/get，管理入口除外。

Agent 层可以读写 `router/session/`，但禁止 import `router/archive/`。

上层 Agent 目录禁止直接 import `router/session/` 和 `router/archive/`。
