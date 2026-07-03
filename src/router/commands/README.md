# commands

指令层 — 以 `/` 开头的消息在此拦截，直接执行不经过 AI。

## 当前指令

| 指令 | 功能 |
|---|---|
| `/help` | 显示所有可用指令 |
| `/start` `/new` | 创建新对话并切换，旧对话保留 |
| `/admin as <QQ> /命令 参数` | 管理员以指定用户身份执行已有命令 |
| `/admin new-all` | 管理员为所有非管理员账号创建新对话 |
| `/admin user add/del/list <QQ>` | 管理员管理用户白名单 |
| `/admin group add/del/list <群号>` | 管理员管理群聊白名单 |
| `/admin token total/day/week/month` | 管理员查看全局 Token 消耗 |

## 新增指令

在 `commands/` 下新增文件，调用 `commandRegistry.register()`：

```ts
import { commandRegistry } from "./registry";

commandRegistry.register({
  name: "xxx",
  description: "功能描述",
  async execute(userId, args) {
    return "回复文本";
  },
});
```

然后在 `message-router.ts` 中 import 该文件以触发自注册。
