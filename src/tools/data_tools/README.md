# data_tools

用户长期数据工具目录。这里的工具通过 `toolRegistry` 注册，供不同 Agent 按需选择。

- `create-*` / `update-*` / `delete-*`：维护用户知识目录、Markdown 文件和条目。
- `get-entry.ts`：读取指定条目内容。
- `folder-tree.ts`：返回用户可见的数据目录树。
- `data_engine/`：封装底层文件读写和目录扫描逻辑。

注意：`data/{userId}/session/` 等运行时内部目录不属于用户可见知识库，目录树和上下文注入都必须过滤。
