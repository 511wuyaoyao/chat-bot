/**
 * QQ 官方 Bot 消息 payload 转换测试。
 */

import test from "node:test";
import assert from "node:assert/strict";
import { oneBotMessageToQQBotPayload } from "../src/adapter/implementations/qqbot-to-onebot/message";

test("OneBot reply 段转换为 QQBot 引用消息 ID，且不渲染为文本", () => {
  const payload = oneBotMessageToQQBotPayload([
    { type: "reply", data: { id: 123456 } },
    { type: "text", data: { text: "收到" } },
  ]);

  assert.deepEqual(payload, {
    content: "收到",
    referenceMessageId: "123456",
  });
});

test("普通文本消息不携带引用消息 ID", () => {
  const payload = oneBotMessageToQQBotPayload("主动消息");

  assert.deepEqual(payload, {
    content: "主动消息",
  });
});
