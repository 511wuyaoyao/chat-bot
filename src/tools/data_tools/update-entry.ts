/**
 * update_entry — 更新条目
 */

import fs from "fs";
import path from "path";
import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { updateEntry } from "./data_engine/file-engine";
import { EntryData } from "./data_engine/entities";
import { getStatusChar } from "./status-map";
import { TOOL_GUIDE_UPDATE_ENTRY } from "../../prompt";

toolRegistry.register({
  usageGuide: TOOL_GUIDE_UPDATE_ENTRY,
  definition: {
    type: "function",
    function: {
      name: "update_entry",
      description:
        "更新一个条目。通过标题匹配找到条目。fields 为要修改的自由键值对，字段名用中文。" +
        "如 {\"状态\":\"已完成\",\"备注\":\"看完了\",\"兴趣度\":20}。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "条目标题，必填" },
          fields: {
            type: "object",
            description: "要修改的键值对，只传需要修改的字段",
          },
          interestDelta: {
            type: "number",
            description: '兴趣度变化值，如 +25、-40、-80。自动从条目的"兴趣度"字段加减',
          },
          newFolder: { type: "string", description: "移动到新分类" },
          newFile: { type: "string", description: "移动到新文件（不含 .md）" },
        },
        required: ["title"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const title = String(args.title);
    const fields = (args.fields as Record<string, unknown>) || {};

    const data: EntryData = { title };
    for (const [k, v] of Object.entries(fields)) {
      if (v === null || v === undefined) continue;
      data[k] = v;
    }

    // 状态（中文）→ engine 内部键
    const stateValue = data["状态"] as string | undefined;
    if (stateValue) {
      data.status = stateValue;
      data.statusChar = getStatusChar(stateValue);
    }

    // interestDelta：从现有条目读取原值再加减
    if (args.interestDelta) {
      const old = findField(userId, title, "兴趣度");
      const oldVal = old ? parseInt(old) || 60 : 60;
      data["兴趣度"] = Math.max(0, Math.min(100, oldVal + (args.interestDelta as number)));
    }

    const opts = {
      ...(args.newFolder ? { newFolder: args.newFolder as string } : {}),
      ...(args.newFile ? { newFile: (args.newFile as string) + ".md" } : {}),
    };

    const ok = updateEntry(userId, title, data, Object.keys(opts).length > 0 ? opts : undefined);
    return ok
      ? { success: true, title }
      : { success: false, error: `找不到条目："${title}"` };
  },
});

function findField(userId: string, title: string, field: string): string | null {
  const dir = path.join(process.cwd(), "data", userId);
  if (!fs.existsSync(dir)) return null;
  function walk(d: string): string | null {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "README.md") continue;
      const fp = path.join(d, e.name);
      if (e.isDirectory()) { const r = walk(fp); if (r) return r; }
      else if (e.name.endsWith(".md")) {
        for (const line of fs.readFileSync(fp, "utf-8").split("\n")) {
          if (line.includes(title)) {
            const m = line.match(new RegExp(`${field}[：:]\\s*(.+?)(?:\\s{2}|$)`));
            if (m) return m[1];
          }
        }
      }
    }
    return null;
  }
  return walk(dir);
}
