/**
 * /admin — 管理员命令
 * 提供管理员代用户执行命令，以及为所有非管理员账号创建新对话的能力。
 */

import fs from "fs";
import path from "path";
import { config } from "../../config";
import { formatGlobalTokenUsageReport, TokenUsagePeriod } from "../../agent/token-usage";
import { messages } from "../../prompt";
import { commandRegistry } from "./registry";

const DATA_ROOT = path.resolve(process.cwd(), "data");
const ENV_PATH = path.resolve(process.cwd(), ".env");

commandRegistry.register({
  name: "admin",
  description: "管理员命令：代用户执行命令、批量创建新对话、管理白名单",
  async execute(userId: string, args: string[]): Promise<string> {
    if (!isAdmin(userId)) return messages.commands.adminDenied;

    const action = args[0] ?? "";
    if (action === "as") return executeAsUser(args.slice(1));
    if (action === "new-all") return executeNewAll();
    if (action === "user") return executeWhitelist("user", args.slice(1));
    if (action === "group") return executeWhitelist("group", args.slice(1));
    if (action === "token") return executeToken(args.slice(1));

    return messages.commands.adminHelp;
  },
});

async function executeAsUser(args: string[]): Promise<string> {
  const targetUserId = args[0]?.trim();
  const commandText = args.slice(1).join(" ").trim();
  if (!targetUserId || !commandText) return messages.commands.adminAsUsage;
  if (commandText[0] !== "/" && commandText[0] !== "#") {
    return messages.commands.adminAsCommandOnly;
  }

  const matched = commandRegistry.match(commandText);
  if (!matched) return messages.commands.adminAsUnknownCommand;
  if (matched.handler.name === "admin") return messages.commands.adminAsRecursiveDenied;

  const reply = await matched.handler.execute(targetUserId, matched.args);
  return messages.commands.adminAsDone(targetUserId, reply);
}

async function executeNewAll(): Promise<string> {
  const targets = nonAdminUserIds();
  if (targets.length === 0) return messages.commands.adminNewAllEmpty;

  const matched = commandRegistry.match("/new");
  if (!matched) return messages.commands.adminAsUnknownCommand;

  for (const targetUserId of targets) {
    await matched.handler.execute(targetUserId, matched.args);
  }

  return messages.commands.adminNewAllDone(targets.length);
}

function nonAdminUserIds(): string[] {
  const ids = new Set<string>(config.qq.userWhitelist);
  for (const userId of dataUserIds()) ids.add(userId);

  for (const adminId of config.qq.adminIds) ids.delete(adminId);
  return Array.from(ids).sort();
}

function dataUserIds(): string[] {
  if (!fs.existsSync(DATA_ROOT)) return [];

  return fs.readdirSync(DATA_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+$/.test(entry.name))
    .map((entry) => entry.name);
}

function isAdmin(userId: string): boolean {
  return config.qq.adminIds.includes(userId);
}

function executeToken(args: string[]): string {
  const period = args[0] || "total";
  if (!isTokenUsagePeriod(period)) return messages.commands.adminTokenUsage;
  return formatGlobalTokenUsageReport(period);
}

function executeWhitelist(kind: "user" | "group", args: string[]): string {
  const action = args[0] ?? "";
  const id = args[1]?.trim();
  const label = kind === "user" ? "用户" : "群聊";
  const list = kind === "user" ? config.qq.userWhitelist : config.qq.groupWhitelist;

  if (action === "list") return messages.commands.whitelistList(label, list);
  if ((action !== "add" && action !== "del") || !id) return messages.commands.whitelistUsage;

  if (action === "add") {
    if (list.includes(id)) return messages.commands.whitelistExists(label, id);
    list.push(id);
    syncLegacyWhitelist();
    persistWhitelist(kind);
    return messages.commands.whitelistAdded(label, id);
  }

  const index = list.indexOf(id);
  if (index < 0) return messages.commands.whitelistMissing(label, id);
  list.splice(index, 1);
  syncLegacyWhitelist();
  persistWhitelist(kind);
  return messages.commands.whitelistRemoved(label, id);
}

function syncLegacyWhitelist(): void {
  config.qq.whitelist = [...config.qq.userWhitelist];
}

function persistWhitelist(kind: "user" | "group"): void {
  const key = kind === "user" ? "QQ_WHITELIST" : "QQ_GROUP_WHITELIST";
  const values = kind === "user" ? config.qq.userWhitelist : config.qq.groupWhitelist;
  setEnvJsonList(key, values);
}

function setEnvJsonList(key: string, values: string[]): void {
  const value = JSON.stringify(values);
  const line = `${key}=${value}`;
  const text = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, "utf-8") : "";
  const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");
  const next = pattern.test(text)
    ? text.replace(pattern, line)
    : `${text}${text.endsWith("\n") || !text ? "" : "\n"}${line}\n`;
  fs.writeFileSync(ENV_PATH, next, "utf-8");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isTokenUsagePeriod(value: string): value is TokenUsagePeriod {
  return value === "total" || value === "day" || value === "week" || value === "month";
}
