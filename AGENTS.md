## 开发约定

- 所有代码文件顶部必须有中文注释说明该文件功能
- 每个 src 子文件夹必须有 README.md 说明该文件夹职责
- 迭代开发，当前迭代四：多 Agent 架构（main / exec / topic）+ 消息队列 + 注意力层 + 话题系统
- 使用 `logger` 统一日志，不要用 `console.log`
- 配置通过 `src/config.ts` 集中管理，环境变量在 `.env` 中设置
- **所有用户可见文案**集中到 `src/messages.ts`，禁止硬编码
- 每次写代码前先阅读对应文件夹的 README.md、input.ts、output.ts；如果缺少边界文件，先补齐再继续改代码。

## src 低层目录解耦规则

`src/` 下每个低层职责目录必须保持解耦。低层职责目录指承担明确边界的目录，例如 `adapter/`、`platform/`、`router/`、`agent/`、`scheduler/`，以及它们下面继续拆分出的协议、实现、转换、流水线、渲染器等目录。

### 固定边界文件

每个 `src/` 下的低层职责目录都必须维护两个固定命名的 TypeScript 边界文件：

- `input.ts`：只允许写 `import` / `import type` 语句，用来列出该目录允许依赖和接收的外部类型、入口能力、配置对象或注入对象。
- `output.ts`：只允许写 `export` / `export type` 语句，用来列出该目录允许向外暴露的公开类型、公开函数、公开类和公开常量。

文件名固定，禁止改名为 `inputs.ts`、`outputs.ts`、`contract.ts`、`types.ts` 等其他名字。

### input.ts 强制生效规则

一个低层目录内部的任意代码文件，如果需要依赖本目录外部的东西，必须从本目录最近的 `input.ts` 导入。

允许：

```ts
import { logger } from "./input";
import type { QqMessage } from "./input";
```

禁止：

```ts
import { logger } from "../utils/logger";
import type { QqMessage } from "../platform/output";
```

目录内部不允许直接 import 外部目录、外部包、全局配置或跨层类型；所有外部输入必须先登记在本目录 `input.ts`，再由内部文件从 `./input` 或相对最近的 `../input` 使用。

例外：`input.ts` 自己可以直接 import 外部依赖，因为它就是该目录唯一的外部输入登记点。

### output.ts 强制生效规则

目录外部如果需要使用另一个低层目录的公开能力，必须从目标目录的 `output.ts` 导入。

允许：

```ts
import { MessageQueue } from "../router/output";
import type { QqMessage } from "../platform/output";
```

禁止：

```ts
import { MessageQueue } from "../router/message-queue";
import type { QqMessage } from "../platform/adapter";
```

目录外部不允许穿透到目标目录内部文件。目标目录能对外暴露什么，只由它自己的 `output.ts` 决定。

例外：`output.ts` 自己可以从本目录内部文件 export，因为它就是该目录唯一的公开输出登记点。

### 文件内容限制

`input.ts` 禁止出现：

- `export`
- 运行逻辑
- 副作用
- IO
- 配置读取
- 函数定义
- 类定义
- 接口定义
- 类型别名定义

`output.ts` 禁止出现：

- `import`
- 运行逻辑
- 副作用
- IO
- 配置读取
- 函数定义
- 类定义
- 接口定义
- 类型别名定义

### README 职责

每个 `src/` 子文件夹仍然必须保留 `README.md`，用于说明目录职责、边界和子目录含义。`README.md` 只写职责概览；允许依赖和允许导出的边界分别由 `input.ts` 和 `output.ts` 表达。

### 新增目录要求

在 `src/` 下新增任何低层职责目录时，必须同时新增：

- `README.md`
- `input.ts`
- `output.ts`

新增目录的公开入口应优先使用 `index.ts`，但跨目录调用仍然必须通过该目录的 `output.ts`。

### 禁止事项

- 禁止从 `adapter/implementations/*` 反向依赖 `platform/`。
- 禁止从 `router/` 直接依赖具体外部协议或具体应用实现。
- 禁止用跨目录深层相对路径绕过 `input.ts` / `output.ts`。
- 禁止为了修复类型错误把内部类型重新 export 到不属于它的层级。

## 编码与中文文档约定

- 项目内中文源码注释、README、Markdown 文档统一按 UTF-8 读取和写入。
- 在 Windows PowerShell 中读取中文文件时，必须显式使用 `-Encoding utf8`，例如：`Get-Content -LiteralPath README.md -Raw -Encoding utf8`。
- 如果工具输出中出现 `鍓嶇`、`涓婁笅鏂`、`瀛樺偍` 这类 mojibake 乱码，不要基于乱码内容继续修改；应重新以 UTF-8 读取原文件后再判断。
- 修改中文 README 时，优先整段替换为正常中文 UTF-8 文本，避免把终端乱码再次写回文件。
- 使用 `apply_patch` 修改中文文件时，补丁内容必须直接写正常中文，不要复制 PowerShell 乱码输出。
- 当前环境是 Windows + PowerShell。修改含中文的源码、注释、日志字符串时，要特别注意编码问题。
- 避免使用 PowerShell here-string 管道传 Python 的方式直接写入中文，例如 `@' ... '@ | python -`，这容易导致 UTF-8 中文被误解码成乱码或 `????`。
- 如果必须用 Python 脚本批量修改文件，脚本里的中文字符串优先使用 Unicode escape，例如 `"\u6267\u884c\u8ba1\u5212"`，不要直接在管道脚本里写中文。
- 修改文件优先使用 `apply_patch`。如果 `apply_patch` 在 Windows 沙箱 helper 上失败，再改用 PowerShell，但要显式指定 UTF-8 编码。
- 用 PowerShell 写文件时，优先使用 `Set-Content -Encoding UTF8` 或明确的 UTF-8 写入方式。
- 对已有中文内容做替换前，先读取并确认原文没有乱码；不要基于乱码字符串做精确替换。
- 如果看到类似 `??????` 或 `鎵ц璁″垝` 的内容，先判断为编码损坏，不要继续扩大修改范围。
- 涉及中文日志、中文注释、中文 UI 文案时，修改后必须重新读取相关行，确认中文显示正常。

## 架构概览

```
index.ts  →  MessageQueue  →  message-router
                                  ├─ mainAgent（对话 + 路由）
                                  │    └─ delegate → execAgent（执行）
                                  ├─ topicAgent（静默提炼）
                                  └─ attention/（目录树+时间+话题队列）
```

- Agent 工具从全局 toolRegistry 按名选配，各选各的
- 会话归档双轨：archive 入队即记 / context 只存干净对话
- WS ping + 消息心跳统一在 `qq/connection.ts`
