/**
 * remove_entry 工具
 * 删除一个条目，通过标题模糊匹配或编号精确匹配
 */

import { toolRegistry, ToolHandler } from "../agent/tool-registry";
import { findEntry, deleteEntry, searchEntries } from "../data/file-engine";
import { logger } from "../utils/logger";

function deleteEntryTool(): ToolHandler {
  return {
    definition: {
      type: "function",
      function: {
        name: "remove_entry",
        description: "删除一个条目。通过标题（模糊匹配）或 8 位编号（精确匹配）定位。操作不可逆，请谨慎使用。",
        parameters: {
          type: "object",
          properties: {
            titleOrId: {
              type: "string",
              description: "条目标题或 8 位编号，必填。",
            },
          },
          required: ["titleOrId"],
        },
      },
    },
    async execute(args: Record<string, unknown>, userId: string) {
      const titleOrId = String(args.titleOrId);

      try {
        let entry = findEntry(userId, titleOrId);

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
              })),
              hint: "请用更精确的标题或编号指定要删除哪个",
            };
          }
          entry = candidates[0];
        }

        if (!entry) {
          return { success: false, error: `没找到「${titleOrId}」` };
        }

        const deletedTitle = entry.title;
        const deletedFolder = entry.folderPath;
        const ok = deleteEntry(userId, entry.id);

        logger.debug(`工具 remove_entry`, {
          userId,
          id: entry.id,
          title: deletedTitle,
          success: ok,
        });

        return {
          success: ok,
          title: deletedTitle,
          folderPath: deletedFolder,
        };
      } catch (err) {
        logger.error("工具 remove_entry 失败", { error: String(err), userId });
        return { success: false, error: `删除失败：${String(err)}` };
      }
    },
  };
}

toolRegistry.register(deleteEntryTool());
