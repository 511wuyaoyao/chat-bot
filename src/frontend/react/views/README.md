# frontend/react/views

Debug React 前端页面目录。每个页面必须放在独立文件夹中，并配备本页面 README，README用来描述页面的功能。避免重构时把页面私有逻辑上移到主框架。

## 页面目录

- `trace/`：Trace 列表、搜索、清空、消息隐藏和 trace 详情。
- `sessions/`：Session 浏览、person/session/actor 选择、消息隐藏和详情加载。
- `status/`：Debug 运行状态展示。
- `config/`：Debug 配置加载、草稿、dirty、保存、撤销和用户白名单编辑。

## 边界约定

- `App.tsx` 只负责主框架、左侧导航和当前页面装配。
- 页面自己的 toolbar、刷新、轮询、错误提示、私有状态都留在页面目录。
- 页面之间共享的纯展示组件放到 `components/`。
- 页面之间共享的纯函数放到 `utils/`。
- 新增页面时必须新增 `views/<page>/README.md`。

