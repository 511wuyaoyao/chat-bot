/**
 * 测试 main context 消息 topic 元数据的落盘与过滤行为。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { get } from "../src/router/session/get";
import {
  getCache,
  set,
  updateLatestAssistantMessageId,
  updateMessageTopicByMessageIds,
} from "../src/router/session/set";

function tempContextDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "qqbot-session-topic-"));
}

test("按 message_id 给 user 和 assistant 消息覆盖写入 topic", () => {
  const baseDir = tempContextDir();
  const sessionId = "user1_session1";

  set(sessionId, { role: "user", content: "想学几何节点", message_id: "u-1" }, baseDir);
  set(sessionId, { role: "assistant", content: "可以从实例化开始。" }, baseDir);

  assert.equal(updateLatestAssistantMessageId(sessionId, "a-1", baseDir), true);
  assert.equal(updateMessageTopicByMessageIds(sessionId, ["u-1", "a-1"], "Blender 几何节点", baseDir), 2);

  const messages = getCache(sessionId, baseDir);
  assert.equal(messages[0].topic, "Blender 几何节点");
  assert.equal(messages[1].message_id, "a-1");
  assert.equal(messages[1].topic, "Blender 几何节点");
});

test("get 构建模型上下文时过滤 message_id 和 topic 元数据", () => {
  const baseDir = tempContextDir();
  const sessionId = "user2_session1";

  set(sessionId, {
    role: "user",
    content: "继续这个话题",
    message_id: "u-2",
    topic: "长期项目",
  }, baseDir);

  const apiMessages = get(sessionId, "user2", { baseDir });
  const userMessage = apiMessages.find((msg) => msg.role === "user");

  assert.equal(userMessage?.content, "继续这个话题");
  assert.equal(Object.prototype.hasOwnProperty.call(userMessage, "message_id"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(userMessage, "topic"), false);
});
