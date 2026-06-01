/**
 * update_entry 工具
 * 更新条目：改状态、调整兴趣度、更新进度、改备注等
 */

import { toolRegistry, ToolHandler } from "../agent/tool-registry";
import { findEntry, updateEntry, searchEntries } from "../data/file-engine";
import { adjustInterest } from "../recommend/interest-manager";
import { EntryIndex } from "../data/index-types";
import { logger } from "../utils/logger";
import { TOOL_GUIDE_UPDATE_ENTRY } from "../messages";

function updateEntryTool(): ToolHandler {
  return {
    usageGuide: TOOL_GUIDE_UPDATE_ENTRY,
    definition: {
      type: "function",
      function: {
        name: "update_entry",
        description:
          "更新一个条目。可以改状态（如标记为已完成/已看/搁置）、调整兴趣度（喜欢+25/不喜欢-40/看完-80）、更新进度、修改备注等。通过标题模糊匹配找到条目。",
        parameters: {
          type: "object",
          properties: {
            titleOrId: {
              type: "string",
              description: "条目标题（模糊匹配）或 8 位编号（精确匹配），必填。",
            },
            newStatus: {
              type: "string",
              description: "新状态，如 '已看'、'已完成'、'在看'、'搁置'、'想做'",
            },
            interestDelta: {
              type: "number",
              description: "兴趣度变化量，正数提升负数降低。如喜欢+25、不喜欢-40、看完-80",
            },
            progress: {
              type: "string",
              description: "新进度值，如 'S4'、'80%'",
            },
            note: {
              type: "string",
              description: "新备注",
            },
            importance: {
              type: "string",
              enum: ["高", "中", "低"],
              description: "新重要性",
            },
            url: {
              type: "string",
              description: "新链接",
            },
          },
          required: ["titleOrId"],
        },
      },
    },
    async execute(args: Record<string, unknown>, userId: string) {
      const titleOrId = String(args.titleOrId);
      const newStatus = (args.newStatus as string) || null;
      const interestDelta = args.interestDelta as number | null;
      const progress = (args.progress as string) || null;
      const note = (args.note as string) || null;
      const importance = args.importance as "高" | "中" | "低" | null;
      const url = (args.url as string) || null;

      try {
        // 查找条目
        let entry: EntryIndex | null = findEntry(userId, titleOrId);

        // 如果精确查找失败，尝试模糊搜索
        if (!entry) {
          const candidates = searchEntries(userId, titleOrId);
          if (candidates.length === 0) {
            return { success: false, error: `没找到「${titleOrId}」相关的条目` };
          }
          if (candidates.length > 1) {
            return {
              success: false,
              error: `「${titleOrId}」匹配到多个条目`,
              ambiguous: candidates.map((c) => ({
                id: c.id,
                title: c.title,
                folderPath: c.folderPath,
                status: c.customStatus,
              })),
              hint: "请用更精确的标题或编号指定要更新哪个",
            };
          }
          entry = candidates[0];
        }

        if (!entry) {
          return { success: false, error: `没找到「${titleOrId}」` };
        }

        // 构建更新变更
        const changes: Partial<EntryIndex> = {};

        // 状态变更
        if (newStatus) {
          const statusCharMap: Record<string, EntryIndex["statusChar"]> = {
            已看: "x", 看过: "x", 已完成: "x", 已做: "x", 已买: "x", 已去: "x", 已读完: "x",
            在看: "~", 在玩: "~", 在读: "~", 进行中: "~", 学习中: "~",
            搁置: "-", 废弃: "-", 不想看: "-", 不想去: "-",
            想看: " ", 想做: " ", 想去: " ", 想买: " ", 想学: " ",
          };
          changes.statusChar = statusCharMap[newStatus] || " ";
          changes.customStatus = newStatus;
        }

        if (progress) changes.progress = progress;
        if (note) changes.note = note;
        if (importance) changes.importance = importance;
        if (url) changes.url = url;

        // 执行更新
        const updated = updateEntry(userId, entry.id, changes);

        // 兴趣度调整
        if (interestDelta && interestDelta !== 0) {
          adjustInterest(userId, entry.id, interestDelta);
        }

        logger.debug(`工具 update_entry 成功`, {
          userId,
          id: entry.id,
          title: entry.title,
          newStatus,
          interestDelta,
        });

        return {
          success: true,
          id: entry.id,
          title: updated?.title || entry.title,
          oldStatus: entry.customStatus,
          newStatus: updated?.customStatus || entry.customStatus,
          interest: updated?.interest ?? entry.interest,
          folderPath: entry.folderPath,
        };
      } catch (err) {
        logger.error("工具 update_entry 失败", { error: String(err), userId });
        return { success: false, error: `更新失败：${String(err)}` };
      }
    },
  };
}

toolRegistry.register(updateEntryTool());
