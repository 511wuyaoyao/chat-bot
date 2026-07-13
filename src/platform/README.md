# platform

平台业务层目录。这里负责项目内部统一消息协议、外部协议到内部消息的转换，以及面向 router/main-agent 的平台运行策略。

## 职责

- 定义项目内部统一消息协议。
- 将 OneBot11 事件转换为平台内部消息。
- 处理消息来源分类、白名单、群聊 @ 过滤。
- 将消息段渲染为 agent 可读文本。
- 管理自聊回声过滤和已发送消息追踪。

## 文件

- `input.ts`：platform 目录允许依赖和接收的上游边界。
- `output.ts`：platform 目录允许向外暴露的公开边界。
- `platform.ts`：平台运行入口，连接外部 OneBot11 实现和内部消息处理。
- `connection.ts`：平台消息心跳。
- `self-chat-echo-filter.ts`：自聊回声过滤。

## 子目录

- `internal/`：平台内部协议类型，以及 OneBot11 到内部消息的转换工具。
- `message-pipeline/`：消息分类与过滤流水线。
- `message-segment-renderer/`：消息段渲染。
- `sent-message-tracker/`：已发送消息追踪。
