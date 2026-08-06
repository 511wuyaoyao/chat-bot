# views/sessions

Sessions 页面负责浏览 person / session / actor 的上下文消息。

## 职责

- 加载和轮询 `GET /frontend/sessions`。
- 根据选中的 person / session / actor 加载 `GET /frontend/sessions/:personId/:sessionId/:actor`。
- 管理当前页面 toolbar。
- 管理 person、session、actor 选择。
- 管理消息展示过滤：Source / Tools / Compressed / Topic。
- 展示 session 列表、actor 切换按钮和消息上下文。
- 在 session 列表中标记当前 person 正在使用的 session。
- 在 session 列表和 actor 按钮中用 `active/total` 展示对话条数，例如 `239/639`。
- 对 `deleted: true` 的压缩消息显示特殊标记，并展示压缩层级 `compactionLayer`。
- 每条消息只在存在 `topic` 字段时显示 topic badge；没有 topic 不显示。
- `Topic` 隐藏按钮只隐藏带 `topic` 的消息。
- `Hide compressed` 隐藏的是 `deleted: true` 消息条目。

## API 字段依赖

`GET /frontend/sessions` 的每条 session 需要包含：

- `isCurrent`
- `totalMessageCount`
- `activeMessageCount`
- `deletedMessageCount`
- `actors[].messageCount`
- `actors[].activeMessageCount`

`GET /frontend/sessions/:personId/:sessionId/:actor` 的消息条目中，压缩消息依赖：

- `deleted: true`
- `deletedReason`
- `compactionLayer`
- `deletedAt`
- `topic`

## 边界

- 不把隐藏按钮、actor 切换、session detail 加载、刷新逻辑上移到 `App.tsx`。
- 不修改 Config 页面草稿。
- 不直接访问 router/session 文件系统；只通过前端 API。
- 不在前端自行推断 current session；current session 由后端读取 `current-session.txt` 后返回。
