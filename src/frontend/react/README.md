# frontend/react

前端面板的 React 源码目录，由 Vite 构建为浏览器静态资源。

## 职责

- `main.tsx`：浏览器入口，挂载 React 应用。
- `App.tsx`：应用骨架、导航和页面装配。
- `api.ts`：`/frontend` API 请求封装。
- `types.ts`：前端使用的 API 类型。
- `styles.css`：React 前端样式。
- `views/`：Config / Sessions / Trace / Status 页面。
- `components/`：跨页面复用展示组件。
- `utils/`：纯工具函数。

## 构建

Vite root 指向 `src/frontend/react`。

输出固定到：

- `dist/debug/frontend/assets/client.js`
- `dist/debug/frontend/assets/styles.css`

## 约定

- 后端 API 协议不在前端隐式改动。
- 页面级逻辑放入 `views/`；`App.tsx` 只负责骨架、导航和页面装配。
- Config 页 `QQ_USERS_JSON` 在前端以 person/account 编辑器展示，保存时仍序列化为原字段。
