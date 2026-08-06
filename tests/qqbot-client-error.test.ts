/**
 * QQ 官方 Bot OpenAPI 错误日志格式测试。
 */

import test from "node:test";
import assert from "node:assert/strict";
import { QQBotOfficialClient } from "../src/adapter/implementations/qqbot-to-onebot/client";

test("QQBot HTTP 错误格式包含错误码和中文原因", () => {
  const client = new QQBotOfficialClient({
    appId: "appid",
    appSecret: "secret",
    logger: noopLogger,
  });
  const message = (client as any).formatHttpError(
    500,
    "POST https://api.sgroup.qq.com/v2/users/openid/messages",
    "{\"message\":\"invalid request\",\"code\":11255,\"err_code\":40054004,\"trace_id\":\"trace-1\"}",
    Date.now()
  ) as string;

  assert.match(message, /code=40054004/);
  assert.match(message, /reason=无好友关系/);
  assert.match(message, /message=invalid request/);
  assert.match(message, /trace_id=trace-1/);
});

const noopLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};
