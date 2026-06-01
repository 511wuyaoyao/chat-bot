/**
 * get_folder_tree 工具
 * 返回用户数据目录的树状结构，帮助 AI 了解现有分类
 */

import { toolRegistry, ToolHandler } from "../agent/tool-registry";
import { getIndex } from "../data/file-engine";
import { TreeNode } from "../data/index-types";
import { logger } from "../utils/logger";

/** 统计每个文件夹的条目数 */
function countByFolder(
  node: TreeNode,
  prefix: string,
  folderCounts: Map<string, number>
): void {
  const fullPath = prefix ? `${prefix}/${node.name}` : node.name;
  if (!node.isFile) {
    for (const child of node.children) {
      countByFolder(child, fullPath, folderCounts);
    }
  }
}

function folderTreeTool(): ToolHandler {
  return {
    definition: {
      type: "function",
      function: {
        name: "get_folder_tree",
        description:
          "查看用户的数据目录结构，了解有哪些分类和文件。在不确定条目应放在哪个分类时调用。",
        parameters: {
          type: "object",
          properties: {},
        },
      },
    },
    async execute(_args: Record<string, unknown>, userId: string) {
      try {
        const index = getIndex(userId);
        if (!index) {
          return { success: false, error: "用户索引未初始化" };
        }

        // 构建带条目数的树
        const folderCounts = new Map<string, number>();
        for (const [, entries] of index.byFolder) {
          folderCounts.set(entries[0]?.folderPath || "", entries.length);
        }

        // 简化树结构：folder → files with counts
        const structure: Array<{
          folder: string;
          files: Array<{ name: string; entryCount: number }>;
        }> = [];

        for (const [folderPath, entries] of index.byFolder) {
          const fileMap = new Map<string, number>();
          for (const e of entries) {
            fileMap.set(e.fileName, (fileMap.get(e.fileName) || 0) + 1);
          }
          structure.push({
            folder: folderPath,
            files: Array.from(fileMap.entries()).map(([name, count]) => ({
              name,
              entryCount: count,
            })),
          });
        }

        logger.debug(`工具 get_folder_tree`, {
          userId,
          folders: structure.length,
          totalEntries: index.entries.size,
        });

        return {
          success: true,
          totalEntries: index.entries.size,
          folders: structure,
        };
      } catch (err) {
        logger.error("工具 get_folder_tree 失败", { error: String(err), userId });
        return { success: false, error: `获取目录结构失败：${String(err)}` };
      }
    },
  };
}

toolRegistry.register(folderTreeTool());
