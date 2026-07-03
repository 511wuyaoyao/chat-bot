# web

联网搜索工具目录。负责注册网页搜索、带图片的网页搜索等外部检索工具。

## 工具

| 文件 | 工具 | 说明 |
|---|---|---|
| `web-search.ts` | deepseek_web_search | 调用 DeepSeek Anthropic 端点的服务端搜索，适合实时信息查询和摘要 |
| `tavily-search.ts` | tavily_search | 调用 Tavily Search API，适合网页搜索并可返回关联图片 |

## 约定

- 每个工具文件通过 `toolRegistry.register()` 自注册。
- API Key 从 `src/config.ts` 读取，环境变量写在 `.env` 中。
- 工具失败时返回结构化错误对象，不直接抛出到 Agent Loop。
