/**
 * Debug Config 页面草稿和用户白名单编辑工具。
 */

import type { ConfigDraftValue, DebugConfigGroup, QQUserAccountDraft, QQUserDraft } from "../types";

export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function cloneConfigValue(value: ConfigDraftValue | null): ConfigDraftValue | null {
  if (Array.isArray(value)) return [...value];
  return value;
}

export function configGroupId(group: DebugConfigGroup): string {
  return group.key || group.id || "";
}

export function parseUsers(rawValue: string): QQUserDraft[] {
  try {
    const parsed = JSON.parse(rawValue || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const source = typeof item === "object" && item !== null ? item as Partial<QQUserDraft> : {};
      const accounts = Array.isArray(source.accounts) ? source.accounts.map(normalizeAccount) : [];
      return {
        id: String(source.id || ""),
        name: String(source.name || ""),
        accounts,
        primaryAccount: normalizeAccount(source.primaryAccount || accounts[0] || {}),
        fields: source.fields && typeof source.fields === "object" && !Array.isArray(source.fields) ? source.fields : {},
      };
    });
  } catch {
    return [];
  }
}

export function normalizeAccount(account: Partial<QQUserAccountDraft>): QQUserAccountDraft {
  return {
    platform: account.platform === "napcat" ? "napcat" : "qqbot-official",
    id: String(account.id || ""),
    label: String(account.label || ""),
  };
}

export function syncPrimaryAccount(primary: QQUserAccountDraft, accounts: QQUserAccountDraft[]): QQUserAccountDraft {
  if (!accounts.length) return { platform: "qqbot-official", id: "", label: "" };
  return accounts.some((account) => sameAccount(account, primary)) ? primary : { ...accounts[0] };
}

export function sameAccount(a: QQUserAccountDraft, b: QQUserAccountDraft): boolean {
  return a.platform === b.platform && a.id === b.id;
}

