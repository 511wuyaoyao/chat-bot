# prompt

Agent 提示词目录，集中维护 main / topic / exec 的系统提示词、工具使用说明、动态 attention 包装文案和统一回复风格。

- `main-agent.ts`：主对话 Agent 的能力边界和行为规范。
- `topic-agent.ts`：后台话题提炼、知识库读写和主动 `/topic` 对话规范。
- `exec-agent.ts`：执行 Agent 的任务处理规范。
- `attention.ts`：动态上下文注入的包装文案。
- `tools.ts`：工具调用约束说明。
- `messages.ts`：提示词侧复用文案。
- `style.ts`：统一回复风格。
