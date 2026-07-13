/**
 * 测试 session 级 message meta 的消息定位策略。
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSessionMessageMeta,
  messageMetaContains,
  resolveSessionByMessageId,
  type SessionMessageMeta,
} from "../src/router/message-meta";

test("buildSessionMessageMeta 生成去重排序后的消息集合与范围", () => {
  const meta = buildSessionMessageMeta("u1_s1", [
    { role: "user", content: "a", message_id: "105" },
    { role: "assistant", content: "b", message_id: "101" },
    { role: "user", content: "c", message_id: "105" },
    { role: "system", content: "ignore" },
  ]);

  assert.deepEqual(meta.messageIds, ["101", "105"]);
  assert.equal(meta.minMessageId, 101);
  assert.equal(meta.maxMessageId, 105);
});

test("messageMetaContains 有精确 messageIds 时不允许范围误命中", () => {
  const meta: SessionMessageMeta = {
    sessionId: "u1_s1",
    updatedAt: 1000,
    messageIds: ["101", "105"],
    minMessageId: 101,
    maxMessageId: 105,
  };

  assert.equal(messageMetaContains(meta, 101), true);
  assert.equal(messageMetaContains(meta, 103), false);
  assert.equal(messageMetaContains(meta, 105), true);
});

test("messageMetaContains 只有范围时可以作为降级命中", () => {
  const meta: SessionMessageMeta = {
    sessionId: "u1_s1",
    updatedAt: 1000,
    minMessageId: 101,
    maxMessageId: 105,
  };

  assert.equal(messageMetaContains(meta, 103), true);
  assert.equal(messageMetaContains(meta, 106), false);
});

test("resolveSessionByMessageId 优先精确命中，而不是较新的范围命中", () => {
  const metas: SessionMessageMeta[] = [
    {
      sessionId: "newer_range_only",
      updatedAt: 3000,
      minMessageId: 100,
      maxMessageId: 200,
    },
    {
      sessionId: "older_exact",
      updatedAt: 1000,
      messageIds: ["150"],
      minMessageId: 150,
      maxMessageId: 150,
    },
  ];

  assert.equal(resolveSessionByMessageId(metas, 150)?.sessionId, "older_exact");
});

test("resolveSessionByMessageId 多个精确命中时选择最近更新的 session", () => {
  const metas: SessionMessageMeta[] = [
    {
      sessionId: "old",
      updatedAt: 1000,
      messageIds: ["123"],
      minMessageId: 123,
      maxMessageId: 123,
    },
    {
      sessionId: "new",
      updatedAt: 2000,
      messageIds: ["123"],
      minMessageId: 123,
      maxMessageId: 123,
    },
  ];

  assert.equal(resolveSessionByMessageId(metas, 123)?.sessionId, "new");
});
