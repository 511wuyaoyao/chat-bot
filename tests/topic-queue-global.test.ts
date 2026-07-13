/**
 * 测试 topic queue 按用户全局持久化，而不是依附单个 main session。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  clearTopicQueueCacheForTest,
  getAllTopics,
  pushTopic,
  topicQueueText,
} from "../src/agent/attention/topic_queue";

const DATA_ROOT = path.resolve(process.cwd(), "data");

function testUserId(name: string): string {
  return `topic_queue_test_${name}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function cleanupUser(userId: string): void {
  clearTopicQueueCacheForTest();
  fs.rmSync(path.join(DATA_ROOT, userId), { recursive: true, force: true });
}

test("同一用户不同 session 共享同一个 topic queue", () => {
  const userId = testUserId("shared");
  try {
    assert.equal(pushTopic(userId, "session_a", "技术美术", "单测", "学习几何节点", "yes"), true);

    const topics = getAllTopics(userId, "session_b");
    assert.equal(topics.length, 1);
    assert.equal(topics[0].topic, "技术美术");
  } finally {
    cleanupUser(userId);
  }
});

test("不同用户的 topic queue 相互隔离", () => {
  const userA = testUserId("user_a");
  const userB = testUserId("user_b");
  try {
    pushTopic(userA, "session_a", "电影制片", "单测", "剪辑计划", "yes");
    pushTopic(userB, "session_a", "大模型", "单测", "Agent 架构", "yes");

    assert.deepEqual(getAllTopics(userA, "session_other").map((item) => item.topic), ["电影制片"]);
    assert.deepEqual(getAllTopics(userB, "session_other").map((item) => item.topic), ["大模型"]);
  } finally {
    cleanupUser(userA);
    cleanupUser(userB);
  }
});

test("topicQueueText 读取用户级全局 topic queue", () => {
  const userId = testUserId("text");
  try {
    pushTopic(userId, "session_a", "长期项目", "单测", "跨会话追踪", "ask", 123);

    const text = topicQueueText(userId, "session_b");
    assert.match(text, /当前追踪话题/);
    assert.match(text, /长期项目/);
    assert.match(text, /跨会话追踪/);
  } finally {
    cleanupUser(userId);
  }
});
