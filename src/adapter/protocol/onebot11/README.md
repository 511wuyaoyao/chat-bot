# onebot11

OneBot v11 协议接口定义目录。这里按官方协议拆分消息段、事件、API 和通信层类型。

## 子目录

- `message/`：消息格式与消息段类型。
- `event/`：消息、通知、请求、元事件类型。
- `api/`：action 的请求与响应类型。
- `communication/`：HTTP / WebSocket 通信载荷类型。

## 文件

- `common.ts`：通用基础类型。
- `types.ts`：兼容出口，统一 re-export 全部协议类型。
- `index.ts`：主出口。

## 本项目对 OneBot11 的显式扩展

### 1. ID 类型允许字符串

标准 OneBot11 的用户 ID、群 ID、self ID 通常按 QQ 号/群号的数字语义处理。

本项目把通用 ID 类型定义为：

```ts
export type OneBotId = number | string;
```

原因：

- QQ 官方 Bot 不暴露真实 QQ 号和真实群号。
- 私聊用户标识是 `openid` / `user_openid`。
- 群聊标识是 `group_openid`。
- 这些 ID 是字符串，不能安全转换成数字。

约束：

- 字符串 ID 只表示当前 adapter 作用域内可用的平台 ID。
- `user_id = openid` 不是真实 QQ 号。
- `group_id = group_openid` 不是真实群号。
- 业务层如果需要长期身份，应该使用 person 模型里的 `person_id`，不要把平台外部 ID 当成人的长期 ID。

### 2. `delete_msg` 增加可选目标字段

标准 OneBot11 的 `delete_msg` 请求只有：

```json
{
  "message_id": 123
}
```

为了适配 QQ 官方 Bot 的撤回接口，本项目在 `OneBotDeleteMsgRequest` 上增加两个可选字段：

```ts
user_id?: OneBotId;
group_id?: OneBotId;
```

用途：

- `user_id`：QQ 官方 Bot 私聊撤回时作为 `user_openid` 使用，对应 `DELETE /v2/users/{user_openid}/messages/{message_id}`。
- `group_id`：QQ 官方 Bot 群聊撤回时作为 `group_openid` 使用，对应 `DELETE /v2/groups/{group_openid}/messages/{message_id}`。

约束：

- `message_id` 仍是必填字段。
- `user_id` / `group_id` 只用于 `qqbot-to-onebot` 实现。
- NapCat / 标准 OneBot11 实现可以忽略这两个字段。
- 禁止继续添加未记录的隐式协议字段；如果再次扩展，必须在本 README 里同步记录。
