# commands

指令层 — 以 `/` 开头的消息在此拦截，直接执行不经过 AI。

## 指令命名规则

所有指令名使用英文小写，多个单词用下划线分隔。

## 当前指令

| 指令 | 功能 |
|---|---|
| `/help` | 显示所有可用指令 |
| `/start` `/new` | 创建新对话并切换，旧对话保留 |

## 新增指令

在 `commands/` 下新增文件，调用 `commandRegistry.register()`：
```ts
import { commandRegistry } from "./registry";

commandRegistry.register({
  name: "xxx",          // 指令名（不含 /），英文小写
  description: "功能描述",
  async execute(userId, args) {
    return "回复文本";
  },
});
```
然后在 `message-router.ts` 中 import 该文件以触发自注册。
