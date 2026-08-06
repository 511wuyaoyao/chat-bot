/**
 * QQ 官方 Bot 入站引用消息转 OneBot reply 段测试。
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  officialMessageIdForOneBotMessageId,
  qqBotRawEventToOneBot11,
} from "../src/adapter/implementations/qqbot-to-onebot/to-onebot11";

test("QQ 官方私聊引用消息转换为 OneBot reply 段", () => {
  const event = qqBotRawEventToOneBot11({
    t: "C2C_MESSAGE_CREATE",
    id: "event-current",
    d: {
      id: "official-current",
      content: "回复内容",
      timestamp: "2026-07-28T12:00:00+08:00",
      author: { user_openid: "openid-user" },
      message_reference: { message_id: "official-referenced" },
    },
  });

  assert.equal(event?.post_type, "message");
  assert.deepEqual((event as any).message, [
    { type: "reply", data: { id: hashToPositiveInt("official-referenced") } },
    { type: "text", data: { text: "回复内容" } },
  ]);
  assert.equal(
    officialMessageIdForOneBotMessageId(hashToPositiveInt("official-referenced")),
    "official-referenced"
  );
});

test("QQ 官方群引用消息转换为 OneBot reply 段", () => {
  const event = qqBotRawEventToOneBot11({
    t: "GROUP_AT_MESSAGE_CREATE",
    id: "event-current",
    d: {
      id: "official-current",
      content: "群回复",
      group_openid: "group-openid",
      author: { member_openid: "member-openid" },
      reference: { msg_id: "official-group-referenced" },
    },
  });

  assert.equal(event?.post_type, "message");
  assert.deepEqual((event as any).message, [
    { type: "reply", data: { id: hashToPositiveInt("official-group-referenced") } },
    { type: "text", data: { text: "群回复" } },
  ]);
});

test("QQ official message_type=103 resolves ref_msg_idx content", () => {
  const source = qqBotRawEventToOneBot11({
    t: "C2C_MESSAGE_CREATE",
    id: "event-source",
    d: {
      id: "official-source",
      message_type: 0,
      content: "quoted content",
      message_scene: { ext: ["msg_idx=MSGIDX-source"] },
      author: { user_openid: "openid-user" },
    },
  });
  assert.equal(source?.post_type, "message");

  const event = qqBotRawEventToOneBot11({
    t: "C2C_MESSAGE_CREATE",
    id: "event-current",
    d: {
      id: "official-current",
      message_type: 103,
      content: "what did this say",
      message_scene: { ext: ["ref_msg_idx=MSGIDX-source", "msg_idx=MSGIDX-current"] },
      author: { user_openid: "openid-user" },
    },
  });

  assert.equal(event?.post_type, "message");
  assert.deepEqual((event as any).message, [
    { type: "reply", data: { id: (source as any).message_id } },
    { type: "text", data: { text: "what did this say" } },
  ]);
  assert.equal((event as any).reply.raw_message, "quoted content");
});

function hashToPositiveInt(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}
