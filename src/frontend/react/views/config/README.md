# views/config

Config 页面负责配置的可视化读取、编辑、保存和热更新。

## 职责

- 加载和轮询 `GET /frontend/config`。
- 保存 `PATCH /frontend/config`。
- 管理当前页面 toolbar。
- 管理配置 draft、dirty 字段、字段错误、保存状态和保存消息。
- 管理配置分组选择。
- 自动刷新时保留用户未保存的 editable draft。
- 以可视化 person/account 编辑器管理 `QQ_USERS_JSON`。
- 平台配置必须拆分展示：
  - `Platform`：当前 adapter、端口、WebSocket ping、业务消息心跳等通用运行项。
  - `NapCat`：`NAPCAT_BASE_URL`、NapCat 原始事件日志、`NAPCAT_TOKEN` 配置状态。
  - `QQBot Official`：QQ 官方 Bot transport、AppID、OpenAPI base URL、API timeout、webhook path、原始事件日志、AppSecret 配置状态。

## 只读规则

- 只有 token、secret、API key 这类敏感凭据状态应该作为只读字段展示。
- token、secret、API key 只显示 configured/missing，不显示明文，也不从前端编辑。
- 非敏感配置如果可以运行期生效，就应该做成可编辑热更新字段。
- 非敏感但不适合作为表单字段的信息，放进 `readOnlyStatus` JSON 状态区展示，不放成 readonly 表单项。

## 平台配置分组规则

- 不同平台的配置必须分开写、分开展示，不允许全部塞进 `Platform` 组。
- `Platform` 组只放跨平台通用项：
  - `PLATFORM_ADAPTER`
  - `PORT`
  - `WS_PING_INTERVAL_SECONDS`
  - `WS_PING_SUMMARY_MINUTES`
  - `HEARTBEAT_MINUTES`
  - `HEARTBEAT_FAIL_THRESHOLD`
- `NapCat` 组只放 NapCat / OneBot11 专属项：
  - `NAPCAT_BASE_URL`
  - `NAPCAT_RAW_EVENT_LOG_ENABLED`
  - `NAPCAT_TOKEN` 配置状态
- `QQBot Official` 组只放 QQ 官方 Bot 专属项：
  - `QQBOT_TRANSPORT`
  - `QQBOT_APP_ID`
  - `QQBOT_API_BASE_URL`
  - `QQBOT_API_TIMEOUT_MS`
  - `QQBOT_WEBHOOK_PATH`
  - `QQBOT_RAW_EVENT_LOG_ENABLED`
  - `QQBOT_APP_SECRET` 配置状态

## 配置前端化规则

- `env/` 和 `src/config/` 中新增或修改的配置，默认都必须进入 Config 页。
- 敏感配置进入 Config 页时只展示 configured/missing 状态，不提供输入框。
- 非敏感配置必须提供可视化字段，能热更新的要接入对应 reload hook。
- 如果某个配置不能前端化，必须在本 README 写明原因和替代查看方式。

## 私有状态

- config state。
- config draft。
- dirty keys。
- field errors。
- selected config group。
- saving 状态。
- save message。
- 页面加载错误。

## 边界

- 保存、撤销、dirty 判断、字段错误展示都属于本页面，不上移到 `App.tsx`。
- 不展示或编辑敏感密钥明文。
- 不直接写 env 文件；只能通过 `PATCH /frontend/config`。
- 不把 `QQ_USERS_JSON` 退回大段 JSON textarea，除非后续明确决定取消可视化编辑器。
