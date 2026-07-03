# tools

全局工具目录。每个工具自注册到 `toolRegistry`，Agent 按需选配。

## 工具分类

| 目录 | 工具 | Agent 选配 |
|---|---|---|
| `data_tools/` | add_entry, update_entry, delete_entry, get_entry, get_tree, create_folder, delete_folder, delete_file, update_folder | topic-agent 全部, main/exec 只读 |
| `schedule_tools/` | add_schedule, update_schedule, delete_schedule, query_schedules | main-agent, exec-agent |
| `topic_tools/` | push_topic, ask_user | topic-agent |
| `web/` | deepseek_web_search, tavily_search | main-agent 使用 deepseek_web_search，exec-agent 使用 tavily_search |

## 设计原则

- **注册制**：每个文件调用 `toolRegistry.register()` 自注册
- **Agent 选单**：各 Agent 从全局目录按名选取
- **执行分离**：agent 特有的工具（delegate 等）在 agent 自己的 tools.ts 中定义，不走 toolRegistry
