/**
 * 测试上下文压缩管理的逻辑删除策略。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { maybeCompactContext, clearContextCompactionCooldownForTest } from "../src/router/session/context-manager";
import { get } from "../src/router/session/get";
import { getCache, mutateContext } from "../src/router/session/set";
import type { StoredMessage } from "../src/router/session/utils/types";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "qqbot-context-"));
}

function writeContext(baseDir: string, messages: StoredMessage[]): void {
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(path.join(baseDir, "context.json"), JSON.stringify(messages, null, 2), "utf-8");
}

function loadContext(sessionId: string, baseDir: string): StoredMessage[] {
  return getCache(sessionId, baseDir);
}

function usage(promptTokens: number): unknown {
  return { prompt_tokens: promptTokens };
}

test("main 第一层逻辑删除工具调用痕迹并保留最终回复", () => {
  clearContextCompactionCooldownForTest();
  const baseDir = tmpDir();
  const sessionId = "u_main_l1";
  writeContext(baseDir, [
    { role: "user", content: "查一下" },
    { role: "assistant", content: null, tool_calls: [{ id: "call_1", function: { name: "get_tree", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "call_1", content: "{}" },
    { role: "assistant", content: "查到了" },
  ]);

  const result = maybeCompactContext({ sessionId, actor: "main-agent", usage: usage(8000), baseDir });
  const messages = loadContext(sessionId, baseDir);

  assert.equal(result.reason, "compacted");
  assert.equal(result.changed, 2);
  assert.equal(messages[1].deleted, true);
  assert.equal(messages[1].deletedReason, "main_tool_trace");
  assert.equal(messages[2].deleted, true);
  assert.equal(messages[3].deleted, undefined);
});

test("main 第二层删除无 topic 普通消息并保护最近 6 条", () => {
  clearContextCompactionCooldownForTest();
  const baseDir = tmpDir();
  const sessionId = "u_main_l2";
  const messages: StoredMessage[] = [];
  for (let i = 0; i < 8; i++) {
    messages.push({ role: "user", content: `u${i}`, topic: i === 0 ? "t0" : undefined });
  }
  writeContext(baseDir, messages);

  const result = maybeCompactContext({ sessionId, actor: "main-agent", usage: usage(16000), baseDir });
  const updated = loadContext(sessionId, baseDir);

  assert.equal(result.reason, "compacted");
  assert.equal(updated[0].deleted, undefined);
  assert.equal(updated[1].deleted, true);
  assert.equal(updated[1].deletedReason, "main_no_topic");
  for (let i = 2; i < 8; i++) {
    assert.equal(updated[i].deleted, undefined);
  }
});

test("topic 第一层删除 user 消息", () => {
  clearContextCompactionCooldownForTest();
  const baseDir = tmpDir();
  const sessionId = "u_topic_l1";
  writeContext(baseDir, [
    { role: "user", content: "【当前模式：被动分析】" },
    { role: "assistant", content: "无需记录" },
  ]);

  const result = maybeCompactContext({ sessionId, actor: "topic-agent", usage: usage(4000), baseDir });
  const messages = loadContext(sessionId, baseDir);

  assert.equal(result.reason, "compacted");
  assert.equal(messages[0].deleted, true);
  assert.equal(messages[0].deletedReason, "topic_user");
  assert.equal(messages[1].deleted, undefined);
});

test("topic 第二层删除工具调用痕迹", () => {
  clearContextCompactionCooldownForTest();
  const baseDir = tmpDir();
  const sessionId = "u_topic_l2";
  writeContext(baseDir, [
    { role: "user", content: "分析" },
    { role: "assistant", content: null, tool_calls: [{ id: "call_1", function: { name: "push_topic", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "call_1", content: "{\"added\":true}" },
    { role: "assistant", content: "已判断", compactionHints: { topicWritten: true } },
  ]);

  const first = maybeCompactContext({ sessionId, actor: "topic-agent", usage: usage(8000), baseDir });
  const second = maybeCompactContext({ sessionId, actor: "topic-agent", usage: usage(8000), baseDir });
  const messages = loadContext(sessionId, baseDir);

  assert.equal(first.reason, "compacted");
  assert.equal(second.reason, "compacted");
  assert.equal(messages[0].deletedReason, "topic_user");
  assert.equal(messages[1].deletedReason, "topic_tool_trace");
  assert.equal(messages[2].deletedReason, "topic_tool_trace");
  assert.equal(messages[3].deleted, undefined);
});

test("topic 第三层删除无沉淀助手回复并保护最近 6 条", () => {
  clearContextCompactionCooldownForTest();
  const baseDir = tmpDir();
  const sessionId = "u_topic_l3";
  const messages: StoredMessage[] = [];
  for (let i = 0; i < 8; i++) {
    messages.push({
      role: "assistant",
      content: `a${i}`,
      compactionHints: i === 0 ? { topicWritten: true } : undefined,
    });
  }
  writeContext(baseDir, messages);

  const result = maybeCompactContext({ sessionId, actor: "topic-agent", usage: usage(12000), baseDir });
  const updated = loadContext(sessionId, baseDir);

  assert.equal(result.reason, "compacted");
  assert.equal(updated[0].deleted, undefined);
  assert.equal(updated[1].deleted, true);
  assert.equal(updated[1].deletedReason, "topic_no_persist");
  for (let i = 2; i < 8; i++) {
    assert.equal(updated[i].deleted, undefined);
  }
});

test("15 分钟内存冷却未到时不重复压缩同一层", () => {
  clearContextCompactionCooldownForTest();
  const baseDir = tmpDir();
  const sessionId = "u_cooldown";
  writeContext(baseDir, [
    { role: "user", content: "u0" },
    { role: "assistant", content: null, tool_calls: [{ id: "call_1", function: { name: "x", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "call_1", content: "{}" },
    { role: "assistant", content: null, tool_calls: [{ id: "call_2", function: { name: "x", arguments: "{}" } }] },
    { role: "tool", tool_call_id: "call_2", content: "{}" },
  ]);

  const first = maybeCompactContext({ sessionId, actor: "main-agent", usage: usage(8000), baseDir });
  const second = maybeCompactContext({ sessionId, actor: "main-agent", usage: usage(8000), baseDir });

  assert.equal(first.reason, "compacted");
  assert.equal(second.reason, "cooldown");
});

test("deleted 消息不进入 session/get 返回的模型上下文", () => {
  clearContextCompactionCooldownForTest();
  const baseDir = tmpDir();
  const sessionId = "u_get_deleted";
  writeContext(baseDir, [
    { role: "user", content: "保留" },
    { role: "assistant", content: "删除", deleted: true, deletedReason: "main_no_topic" },
  ]);

  const messages = get(sessionId, "u", { baseDir });

  assert.equal(messages.some((msg) => msg.content === "删除"), false);
  assert.equal(loadContext(sessionId, baseDir).length, 2);
});

test("mutateContext 返回 false 时不写盘", () => {
  const baseDir = tmpDir();
  const sessionId = "u_mutate_noop";
  writeContext(baseDir, [{ role: "user", content: "a" }]);
  const before = fs.readFileSync(path.join(baseDir, "context.json"), "utf-8");

  const changed = mutateContext(sessionId, () => false, baseDir);
  const after = fs.readFileSync(path.join(baseDir, "context.json"), "utf-8");

  assert.equal(changed, false);
  assert.equal(after, before);
});
