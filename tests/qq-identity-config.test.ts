/**
 * QQ 用户身份配置解析测试。
 */

import assert from "node:assert/strict";
import test from "node:test";
import { accountKey, buildQQIdentityConfig, parseQQIdentityConfig, parseQQUsersJson } from "../src/config/identity";

test("QQ_USERS_JSON 支持一个 person 绑定多个平台账号", () => {
  const users = parseQQUsersJson(JSON.stringify([
    {
      id: "wuyao",
      name: "吴尧尧",
      accounts: [
        { platform: "napcat", id: "2982428629", label: "QQ号" },
        { platform: "qqbot-official", id: "2BA383EC33356E3D46BAA786C8156505", label: "官方openid" },
      ],
      primaryAccount: { platform: "qqbot-official", id: "2BA383EC33356E3D46BAA786C8156505" },
      fields: { role: "owner" },
    },
  ]));
  const identity = buildQQIdentityConfig(users, [], ["2982428629"]);

  assert.deepEqual(identity.userWhitelist, ["wuyao"]);
  assert.equal(identity.accountToUser[accountKey("napcat", "2982428629")]?.id, "wuyao");
  assert.equal(identity.accountToUser[accountKey("qqbot-official", "2BA383EC33356E3D46BAA786C8156505")]?.id, "wuyao");
  assert.ok(identity.adminIds.includes("2982428629"));
  assert.ok(identity.adminIds.includes("wuyao"));
});

test("QQ_USERS_JSON 拒绝重复账号映射", () => {
  const users = parseQQUsersJson(JSON.stringify([
    {
      id: "a",
      accounts: [{ platform: "napcat", id: "10000" }],
      primaryAccount: { platform: "napcat", id: "10000" },
    },
    {
      id: "b",
      accounts: [{ platform: "napcat", id: "10000" }],
      primaryAccount: { platform: "napcat", id: "10000" },
    },
  ]));

  assert.throws(() => buildQQIdentityConfig(users, [], []), /同时映射/);
});

test("没有 QQ_USERS_JSON 时旧白名单生成 legacy users", () => {
  const identity = parseQQIdentityConfig({
    PLATFORM_ADAPTER: "qqbot-official",
    QQ_USER_WHITELIST: "openid-a,openid-b",
  } as NodeJS.ProcessEnv);

  assert.deepEqual(identity.userWhitelist, ["openid-a", "openid-b"]);
  assert.equal(identity.users[0].primaryAccount.platform, "qqbot-official");
  assert.equal(identity.accountToUser[accountKey("qqbot-official", "openid-a")]?.id, "openid-a");
});

test("QQ_USERS_JSON 非法 JSON 会抛出明确错误", () => {
  assert.throws(() => parseQQUsersJson("{bad"), /QQ_USERS_JSON 不是合法 JSON/);
});
