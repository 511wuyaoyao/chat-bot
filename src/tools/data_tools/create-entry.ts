/**
 * add_entry — 创建条目
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { addEntry } from "./data_engine/file-engine";
import { EntryData } from "./data_engine/entities";
import { getStatusChar } from "./status-map";
import { nowLocal } from "../../utils/time-utils";
import { TOOL_GUIDE_ADD_ENTRY } from "../../prompt";

toolRegistry.register({
  usageGuide: TOOL_GUIDE_ADD_ENTRY,
  definition: {
    type: "function",
    function: {
      name: "add_entry",
      description:
        "创建/记录一个新条目。fields 为自由键值对，字段名用中文，值用字符串或数字。常用参考：" +
        "状态（想做/进行中/已完成/搁置/已看/想去/想学…）、" +
        "备注、链接、兴趣度（0-100）、进度、重要性（高/中/低）、" +
        "提醒时间（YYYY-MM-DD HH:mm）、截止时间（YYYY-MM-DD HH:mm）、" +
        "重复规则（daily:HH:mm | weekly:D:HH:mm，D: 0=周日）。" +
        "其余字段由你根据内容类型自行决定。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "条目标题，必填" },
          folderPath: { type: "string", description: "分类路径，如 娱乐、学习/课程" },
          fileName: { type: "string", description: "文件名（不含 .md），如 电影、日程表" },
          fields: {
            type: "object",
            description: "自由键值对，键为字段名，值为字符串或数字。如 {\"status\":\"想看\",\"url\":\"https://...\",\"interest\":80}",
          },
        },
        required: ["title"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const title = String(args.title);
    const folderPath = (args.folderPath as string) || "默认";
    const fileName = ((args.fileName as string) || "未分类") + ".md";
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

    data.createdAt = nowLocal();

    const ok = addEntry(userId, folderPath, fileName, data);
    return ok
      ? { success: true, title, folderPath, fileName }
      : { success: false, error: `创建失败：${title}` };
  },
});
