# agent

多 Agent 架构。通用循环引擎 + 三个独立 Agent，各选各的工具。

## 架构

```
agent-loop.ts          ← 通用循环引擎（tools/prompt/model/params 可配置）
tool-registry.ts       ← 全局工具目录（tools/ 下所有工具注册于此）
llm-client.ts          ← 共享 OpenAI 客户端（懒加载单例）
qa-fallback.ts         ← 兜底 QA（API 失败时使用）
agent-tracker.ts       ← 消息归属追踪（供引用回复路由）

agents/
  main-agent/          ← 主 Agent（对话 + 路由）
    index.ts           ←   入口 + 会话管理
    tools.ts           ←   工具选单
  exec-agent/          ← 执行 Agent（plan 执行）
    index.ts
    tools.ts
  topic-agent/         ← 话题 Agent（静默提炼）
    index.ts

attention/             ← 注意力层（长期记忆 → 本轮上下文注入）
  index.ts             ←   组装入口
  folder_tree.ts       ←   目录树上下文（30s 缓存）
  time.ts              ←   当前时间
  topic_queue.ts       ←   话题队列 CRUD（内存缓存 + 原子写入）
```

## 工具分配

| Agent | 工具 |
|---|---|
| main-agent | web_search, get_entry, get_tree, schedule 全套, delegate |
| exec-agent | web_search, get_entry, get_tree, schedule 全套 |
| topic-agent | data 全套（读写）, push_topic, ask_user |

## 调用链

```
router → mainAgent → agentLoop(tools: 主 Agent 选单, prompt: PROMPT_MAIN + attention)
  mainAgent → delegate → execAgent → agentLoop(tools: exec 选单, session: 临时)
  topic-agent 通过独立队列消费（不在此层触发）
```

## 权限边界

```
agent-loop ← 唯一拥有 session 权限（router/session/ set/get）
main/topic/exec-agent ← 不碰 session，只传 sessionId 给 agentLoop

Router 层（message-queue, message-router）
  → 只读写 router/archive/（archive.jsonl）
  → 禁止 import router/session/ 的 set/get（manage 除外）
```
