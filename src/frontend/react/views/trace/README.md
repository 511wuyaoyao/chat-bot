# views/trace

Trace 页面负责浏览最近的 LLM 调用 trace，用来及时观察请求、响应、工具事件，并在需要时查看完整原始 JSON。

## 职责

- 轮询 `GET /frontend/traces` 加载 trace 列表。
- 选中 trace 后调用 `GET /frontend/traces/:id` 加载完整详情。
- 提供刷新、清空 trace、搜索 trace。
- 提供 `Detail / Raw` 子视图切换。
- `Detail` 子视图展示 trace 元信息、messages、解析后的 response、events。
- `Raw` 子视图单独展示完整 Raw Trace。
- 提供 `Source` 按钮隐藏或展示原始 JSON 部分。

## 私有状态

- trace 列表。
- 当前选中的 trace id。
- 当前选中的 trace 详情。
- 当前 trace 子视图：`detail` 或 `raw`。
- 搜索文本。
- `hideSource` 展示过滤状态。
- 加载错误。

## 边界

- Trace 页面只提供 Source 隐藏功能，用来减少原始 JSON 占屏。
- Trace 页面不提供 Tools / Deleted / Topic 等上下文过滤功能。
- Source 隐藏开启时，message source、response source、event data source 都应隐藏。
- Raw Trace 不混在 Detail 里，必须通过 Raw 子视图进入，避免主详情页被大段 JSON 淹没。
- Session 页负责上下文浏览和被压缩消息隐藏；Config 页负责保存配置；Status 页负责状态展示。
