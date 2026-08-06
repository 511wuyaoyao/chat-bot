/**
 * QQ 用户身份配置解析，把一个自然人映射到多个平台账号。
 */

import { parseStringList } from "./parsers";
import type { PlatformAdapter, QQUserAccount, QQUserConfig } from "./types";

const SAFE_PERSON_ID = /^[A-Za-z0-9_-]{1,128}$/;
const VALID_PLATFORMS = new Set<PlatformAdapter>(["napcat", "qqbot-official"]);

export interface QQIdentityConfig {
  users: QQUserConfig[];
  accountToUser: Record<string, QQUserConfig>;
  userWhitelist: string[];
  legacyAccountWhitelist: string[];
  adminIds: string[];
}

export function parseQQIdentityConfig(env: NodeJS.ProcessEnv): QQIdentityConfig {
  const legacyAccountWhitelist = parseStringList(env.QQ_USER_WHITELIST);
  const primaryPlatform = env.PLATFORM_ADAPTER === "qqbot-official" ? "qqbot-official" : "napcat";
  const users = env.QQ_USERS_JSON?.trim()
    ? parseQQUsersJson(env.QQ_USERS_JSON)
    : legacyUsersFromWhitelist(legacyAccountWhitelist, primaryPlatform);
  return buildQQIdentityConfig(users, legacyAccountWhitelist, parseStringList(env.QQ_ADMIN_IDS));
}

export function buildQQIdentityConfig(
  users: QQUserConfig[],
  legacyAccountWhitelist: string[],
  adminIds: string[]
): QQIdentityConfig {
  validateQQUsers(users);

  const accountToUser: Record<string, QQUserConfig> = {};
  for (const user of users) {
    for (const account of user.accounts) {
      accountToUser[accountKey(account.platform, account.id)] = user;
    }
  }

  return {
    users,
    accountToUser,
    userWhitelist: users.map((user) => user.id),
    legacyAccountWhitelist,
    adminIds: expandAdminIds(users, adminIds),
  };
}

export function parseQQUsersJson(raw: string): QQUserConfig[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`QQ_USERS_JSON 不是合法 JSON: ${String(err)}`);
  }

  if (!Array.isArray(parsed)) throw new Error("QQ_USERS_JSON 必须是数组");
  return parsed.map(normalizeUserConfig);
}

export function validateQQUsers(users: QQUserConfig[]): void {
  const personIds = new Set<string>();
  const accountKeys = new Map<string, string>();

  for (const user of users) {
    if (!SAFE_PERSON_ID.test(user.id)) throw new Error(`用户 id 不安全或为空: ${user.id}`);
    if (personIds.has(user.id)) throw new Error(`用户 id 重复: ${user.id}`);
    personIds.add(user.id);
    if (!Array.isArray(user.accounts) || user.accounts.length === 0) {
      throw new Error(`用户 ${user.id} 至少需要一个账号`);
    }

    for (const account of user.accounts) {
      validateAccount(user.id, account);
      const key = accountKey(account.platform, account.id);
      const existing = accountKeys.get(key);
      if (existing && existing !== user.id) {
        throw new Error(`账号 ${key} 同时映射到 ${existing} 和 ${user.id}`);
      }
      accountKeys.set(key, user.id);
    }

    validateAccount(user.id, user.primaryAccount);
    const hasPrimary = user.accounts.some((account) =>
      account.platform === user.primaryAccount.platform && account.id === user.primaryAccount.id
    );
    if (!hasPrimary) throw new Error(`用户 ${user.id} 的 primaryAccount 不在 accounts 内`);
  }
}

export function accountKey(platform: PlatformAdapter, id: string): string {
  return `${platform}:${id}`;
}

export function findUserByAccount(
  accountToUser: Record<string, QQUserConfig>,
  platform: PlatformAdapter,
  id: string
): QQUserConfig | undefined {
  return accountToUser[accountKey(platform, id)];
}

export function isAdminIdentity(users: QQUserConfig[], adminIds: string[], personId: string, externalAccountId?: string): boolean {
  if (adminIds.includes(personId)) return true;
  if (externalAccountId && adminIds.includes(externalAccountId)) return true;
  const user = users.find((item) => item.id === personId);
  return Boolean(user?.accounts.some((account) => adminIds.includes(account.id)));
}

function expandAdminIds(users: QQUserConfig[], adminIds: string[]): string[] {
  const expanded = new Set(adminIds);
  for (const user of users) {
    if (adminIds.includes(user.id) || user.accounts.some((account) => adminIds.includes(account.id))) {
      expanded.add(user.id);
    }
  }
  return Array.from(expanded);
}

function normalizeUserConfig(value: unknown): QQUserConfig {
  if (!value || typeof value !== "object") throw new Error("QQ_USERS_JSON 包含非对象用户项");
  const src = value as Record<string, unknown>;
  const accounts = Array.isArray(src.accounts) ? src.accounts.map(normalizeAccount) : [];
  const fallbackPrimary = accounts[0];
  const primaryAccount = src.primaryAccount ? normalizeAccount(src.primaryAccount) : fallbackPrimary;
  return {
    id: String(src.id ?? "").trim(),
    name: src.name === undefined ? undefined : String(src.name),
    accounts,
    primaryAccount,
    fields: src.fields && typeof src.fields === "object" && !Array.isArray(src.fields)
      ? src.fields as Record<string, unknown>
      : {},
  };
}

function normalizeAccount(value: unknown): QQUserAccount {
  if (!value || typeof value !== "object") throw new Error("账号项必须是对象");
  const src = value as Record<string, unknown>;
  return {
    platform: src.platform === "qqbot-official" ? "qqbot-official" : "napcat",
    id: String(src.id ?? "").trim(),
    label: src.label === undefined ? undefined : String(src.label),
  };
}

function legacyUsersFromWhitelist(ids: string[], primaryPlatform: PlatformAdapter): QQUserConfig[] {
  return ids.map((id) => ({
    id,
    name: id,
    accounts: [
      { platform: "napcat", id, label: "legacy" },
      { platform: "qqbot-official", id, label: "legacy" },
    ],
    primaryAccount: { platform: primaryPlatform, id, label: "legacy" },
    fields: {},
  }));
}

function validateAccount(userId: string, account: QQUserAccount | undefined): void {
  if (!account) throw new Error(`用户 ${userId} 缺少 primaryAccount`);
  if (!VALID_PLATFORMS.has(account.platform)) throw new Error(`用户 ${userId} 的账号平台无效: ${account.platform}`);
  if (!account.id.trim()) throw new Error(`用户 ${userId} 存在空账号 id`);
}
