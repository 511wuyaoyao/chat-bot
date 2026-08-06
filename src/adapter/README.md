# adapter

外部应用适配层目录。这里负责把 NapCat、QQ 官方 Bot 等具体外部实现适配成项目使用的 OneBot11 风格接口。

## 职责

- 保存外部协议定义，例如 OneBot11。
- 保存具体应用到协议接口的实现，例如 `napcat-to-onebot`、`qqbot-to-onebot`。
- 不保存项目内部消息协议。
- 不处理平台业务策略，例如白名单、群聊 @ 过滤、person 身份归一化。

## 子目录

- `input.ts`：adapter 目录允许依赖和接收的上游边界。
- `output.ts`：adapter 目录允许向外暴露的公开边界。
- `protocol/`：外部协议定义。
- `implementations/`：具体应用到协议接口的运行时实现。

## 协议边界

`protocol/onebot11` 默认按开源 OneBot11 协议建模，但当前项目存在已记录的显式扩展。

当前扩展：

- `OneBotId = number | string`：用于兼容 QQ 官方 Bot 的 `openid` / `group_openid` 字符串 ID。
- `delete_msg` 的请求类型 `OneBotDeleteMsgRequest` 在标准 `message_id` 之外，额外允许可选 `user_id` 和 `group_id`。

具体说明记录在 `protocol/onebot11/README.md`。

约束：

- 任何新增协议扩展必须同步写入 `protocol/onebot11/README.md`。
- 禁止添加未记录的隐式字段。
- 除已记录扩展外，不要为了某个具体 adapter 随意污染 OneBot11 类型。
