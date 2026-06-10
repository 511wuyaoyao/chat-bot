# tools 模块

Agent 可用工具集。每个工具 = JSON Schema 定义 + 执行函数，工具是 file-engine 的薄封装层。

## 文件

- `create-entry.ts` — `add_entry`：创建/记录条目，自动建目录和文件，防重复
- `query-entries.ts` — `find_entries`：模糊搜索 + 文件夹过滤 + 状态筛选，支持精确/模糊/列表三种模式
- `update-entry.ts` — `update_entry`：改状态、调整兴趣度、更新进度/备注，支持模糊匹配和多候选消歧
- `delete-entry.ts` — `remove_entry`：删除条目（markdown 中的一行），模糊匹配定位，多候选时返回列表让 AI 消歧
- `remove-item.ts` — `remove_item`：删除整个 .md 文件或文件夹，用于清理空文件、废弃分类等，不可逆操作
- `move-item.ts` — `move_item`：移动/重命名文件或文件夹，支持合并、拆分、改名等重构操作
- `recommend-items.ts` — `recommend_items`：场景推荐（boredom/hungry/learn），打分排序 + 去重
- `folder-tree.ts` — `get_folder_tree`：返回用户目录结构，帮助 AI 了解现有分类
- `index.ts` — 工具集入口，导入所有工具文件触发自注册

## 设计原则

- **薄封装**：工具只做参数转换和结果格式化，核心逻辑在 data/file-engine 和 recommend/engine
- **自描述**：每个工具的 JSON Schema 完整描述参数和用途，AI 无需额外文档即可正确调用
- **错误友好**：工具返回结构化错误信息（而非抛异常），AI 可以根据错误自行判断处理方式
- **注册制**：每个文件调用 `toolRegistry.register()` 自注册，新增工具只需创建文件即可
