/**
 * add_entry 工具
 * 创建/记录一个新条目，AI 自动判断分类和文件
 */

import { toolRegistry, ToolHandler } from "../agent/tool-registry";
import { addEntry, findEntry, getIndex } from "../data/file-engine";
import { logger } from "../utils/logger";
import { TOOL_GUIDE_ADD_ENTRY } from "../messages";

function createEntryTool(): ToolHandler {
  return {
    usageGuide: TOOL_GUIDE_ADD_ENTRY,
    definition: {
      type: "function",
      function: {
        name: "add_entry",
        description:
          "记录/收藏一个条目到用户的知识库。自动创建不存在的文件夹和文件。用于记录综艺、电影、菜谱、日程、想学的技能等任何内容。",
        parameters: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "条目标题，必填。如 'Running Man'、'宫保鸡丁'、'明天下午3点开会'",
            },
            folderPath: {
              type: "string",
              description: "分类路径，如 '娱乐'、'美食'、'工作'、'学习'。如果不确定，根据内容类型猜测。",
            },
            fileName: {
              type: "string",
              description: "文件名（不含 .md），如 '综艺'、'菜谱'、'日程表'。如果不确定，根据内容类型猜测。",
            },
            url: {
              type: "string",
              description: "链接地址",
            },
            note: {
              type: "string",
              description: "备注/描述信息",
            },
            deadline: {
              type: "string",
              description: "截止时间，格式 YYYY-MM-DD HH:mm，如 '2026-06-03 15:00'",
            },
            remindAt: {
              type: "string",
              description: "提醒时间，格式 YYYY-MM-DD HH:mm",
            },
            repeatRule: {
              type: "string",
              description: "重复规则，如 '每周五 14:00'、'每天 09:00'、'每月1日 09:00'",
            },
            interest: {
              type: "number",
              description: "兴趣度 0-100，默认 60。越高越优先推荐",
            },
            status: {
              type: "string",
              description: "状态描述，如 '想看'、'要做'、'想学'、'想去'",
            },
            progress: {
              type: "string",
              description: "进度，如 'S3'、'第5集'、'80%'",
            },
            importance: {
              type: "string",
              enum: ["高", "中", "低"],
              description: "重要性（四象限），仅日程类条目需要",
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
      const status = (args.status as string) || null;
      const section = status || "想做";

      try {
        // 检查是否已存在同名条目
        const existing = findEntry(userId, title);
        if (existing) {
          return {
            success: false,
            error: `「${title}」已经存在（编号: ${existing.id}，分类: ${existing.folderPath}/${existing.fileName}）`,
            existingEntry: {
              id: existing.id,
              title: existing.title,
              folderPath: existing.folderPath,
              fileName: existing.fileName,
              status: existing.customStatus,
            },
          };
        }

        const entry = addEntry(userId, folderPath, fileName, section, {
          title,
          url: args.url as string | null,
          note: args.note as string | null,
          deadline: args.deadline as string | null,
          remindAt: args.remindAt as string | null,
          repeatRule: args.repeatRule as string | null,
          interest: (args.interest as number) ?? 60,
          status,
          progress: args.progress as string | null,
          importance: args.importance as "高" | "中" | "低" | null,
        });

        logger.debug(`工具 add_entry 成功`, { userId, id: entry.id, title });
        return {
          success: true,
          id: entry.id,
          title: entry.title,
          folderPath: entry.folderPath,
          fileName: entry.fileName,
          status: entry.customStatus,
          interest: entry.interest,
        };
      } catch (err) {
        logger.error("工具 add_entry 失败", { error: String(err), userId, title });
        return { success: false, error: `创建失败：${String(err)}` };
      }
    },
  };
}

toolRegistry.register(createEntryTool());
