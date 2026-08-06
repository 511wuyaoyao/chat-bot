# config

配置模块目录，负责加载 `env/` 下的环境变量文件、解析类型、组织项目运行配置，并执行启动前校验。

## 职责

- `input.ts`：config 目录允许依赖和接收的上游边界。
- `output.ts`：config 目录允许向外暴露的公开边界，业务代码统一从这里读取配置。
- `env.ts`：自动扫描并加载项目根目录下 `env/` 文件夹内的真实 `.env*` 文件。
- `parsers.ts`：提供字符串、数字、布尔值等环境变量解析工具。
- `types.ts`：定义配置相关类型。
- `agent.ts`：组织 Agent 通用参数、thinking 参数、main/topic/exec 模型覆盖配置。
- `services.ts`：组织 DeepSeek、Tavily、Ark 等外部服务配置。
- `platform.ts`：组织 QQ 平台、NapCat、QQ 官方 Bot 连接配置。
- `identity.ts`：组织单一白名单身份系统：person + accounts，不按平台拆分。
- `runtime.ts`：组织日志和 frontend/debug 面板运行期配置。
- `validation.ts`：按当前启用的配置执行启动校验。
- `index.ts`：组合并导出最终 `config` 对象。

## env 加载规则

- 只扫描项目根目录下的 `env/` 文件夹。
- 自动加载 `env/.env` 和 `env/.env.*`。
- 不加载 `env/.env.example` / `env/.env.*.example`。
- 加载优先级：`env/.env` 先加载，其它 `env/.env.*` 按文件名排序加载，`env/.env.local` 最后加载。
- 后加载的文件会覆盖先加载文件里的同名变量。
- 不再扫描项目根目录下的 `.env*` 文件。
- 不再使用 `CONFIG_ENV_FILES` 这种手动指定加载列表的配置。

## env 文件分工

- `env/.env`：全局基础配置，例如当前 `PLATFORM_ADAPTER`。
- `env/.env.access`：单一白名单与身份系统配置，例如 `QQ_USERS_JSON`、群白名单、管理员。
- `env/.env.agent`：Agent 默认参数、thinking 参数、main/topic/exec 模型覆盖。
- `env/.env.debug`：frontend/debug 面板容量和端口等运行期配置。
- `env/.env.llm`：DeepSeek、Tavily、Ark 等外部服务配置。
- `env/.env.log`：日志等级、文件日志目录、保留天数等配置。
- `env/.env.platform.napcat`：NapCat / OneBot11 连接配置。
- `env/.env.platform.qqbot`：QQ 官方 Bot 连接配置。
- `env/.env.local`：本机临时覆盖项；不要把长期业务配置放在这里。

## 约定

业务代码只能从 `src/config/output.ts` 读取配置，不直接读取 `process.env`。

修改或新增配置项时，必须同步维护 `env/` 下对应的真实 env 文件和 example 模板，避免代码里有配置但用户找不到配置入口。

所有配置都需要前端化：修改或新增 `src/config/` 配置时，必须同步维护 `src/frontend/config-manager.ts` 和 Config 页 README。敏感项只显示 configured/missing；非敏感项默认做成可视化字段，并按运行期影响接入 platform / heartbeat / access / debug 等 reload hook。

旧兼容别名不再新增；已有明确保留的 legacy 配置只有 `QQ_USER_WHITELIST`，用于 `QQ_USERS_JSON` 为空时生成 legacy person。
