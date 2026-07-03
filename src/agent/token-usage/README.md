# token-usage

会话级 Token 消耗聚合模块。每次 LLM 调用完成后按 agent 累计 usage，并持久化到主会话目录下的 `token-usage.json`。

## 职责

- 记录 main-agent、exec-agent、topic-agent 的 token 聚合消耗。
- 兼容 DeepSeek / OpenAI 风格 usage 字段。
- 对外只暴露记录和查询格式化函数。
- 不保存单次调用明细，不参与模型上下文。

## 存储

```text
data/{userId}/session/{mainSessionId}/token-usage.json
```
