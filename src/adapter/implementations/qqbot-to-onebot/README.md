# qqbot-to-onebot

QQ 官方机器人到 OneBot11 子集的适配实现。

## 职责

- 接收 QQ 官方机器人原始事件，并转换为 OneBot11 消息事件。
- 将 OneBot11 的基础消息 action 转换为 QQ 官方机器人 OpenAPI 调用。
- 只覆盖当前项目需要的消息收发子集，不模拟好友列表、群成员列表、群管理等个人号能力。

## 支持范围

- `C2C_MESSAGE_CREATE` -> `message.private`
- `GROUP_AT_MESSAGE_CREATE` -> `message.group`
- `send_private_msg` -> `POST /v2/users/{openid}/messages`
- `send_group_msg` -> `POST /v2/groups/{group_openid}/messages`
- `delete_msg` -> `DELETE /v2/users/{user_openid}/messages/{message_id}` 或 `DELETE /v2/groups/{group_openid}/messages/{message_id}`

## 引用消息

### OneBot -> QQ 官方 Bot

OneBot11 使用 `reply` 消息段表达引用：

```json
[
  { "type": "reply", "data": { "id": 123 } },
  { "type": "text", "data": { "text": "回复内容" } }
]
```

QQ 官方机器人发送接口使用 body 里的 `message_reference.message_id` 表达引用展示：

```json
{
  "content": "回复内容",
  "msg_type": 0,
  "message_reference": {
    "message_id": "官方原始消息 ID"
  }
}
```

本实现的映射规则：

- `reply` 段不会渲染成文本。
- `reply.data.id` 会作为引用目标。
- adapter 会优先把 OneBot 数字 `message_id` 映射回 QQ 官方原始 `message_id`。
- 如果找不到映射，则直接把 `reply.data.id` 作为 `message_reference.message_id` 传给 QQ 官方接口。
- 当前不把 OneBot `reply` 段映射到 QQ 官方 `msg_id`；`msg_id` 是被动回复凭证，不是引用展示字段。

## 被动回复

QQ 官方发送单聊消息接口支持通过 `msg_id` / `event_id` 做被动回复，但当前实现暂不使用该能力。

当前规则：

- 普通发送不携带 `msg_id` / `event_id`。
- 收到用户消息后立即回复，也仍按主动消息发送。
- OneBot `reply` 只用于引用展示，映射到 `message_reference.message_id`。
- 后续如果启用被动回复，需要单独设计请求上下文，避免和 OneBot 引用语义混淆。

### QQ 官方 Bot -> OneBot

QQ 官方事件如果带引用/回复字段，本实现会转换成 OneBot `reply` 段，并放在消息段数组最前面。

当前兼容的引用字段来源：

- `message_reference.message_id`
- `message_reference.msg_id`
- `message_reference.id`
- `reference.message_id`
- `reference.msg_id`
- `reference.id`
- `referenced_message.message_id`
- `reply.message_id`
- `src_msg_id`

映射规则：

- QQ 官方原始引用消息 ID 会被转换为 OneBot 数字 `message_id`。
- adapter 同时保存 `OneBot message_id -> QQ 官方原始 msg_id` 映射，供后续再次发送引用消息时还原。

## 撤回消息

`delete_msg` 使用本项目记录过的 OneBot11 扩展字段：

- `user_id`：私聊撤回时作为 `user_openid`。
- `group_id`：群聊撤回时作为 `group_openid`。

如果调用方没有传 `user_id/group_id`，adapter 会尝试使用最近发送消息的运行期映射兜底；该映射只存在于本实现内部，不属于 OneBot11 协议字段。

## 身份映射

- `user_id` 使用 QQ 官方的 `openid`。
- `group_id` 使用 QQ 官方的 `group_openid`。
- 这两个字段不是真实 QQ 号或 QQ 群号，只保证在当前机器人作用域内可用。
