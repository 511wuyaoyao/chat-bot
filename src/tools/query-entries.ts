/**
 * find_entries 工具
 * 搜索/查询条目，支持模糊标题搜索、文件夹过滤、状态筛选
 */

import { toolRegistry, ToolHandler } from "../agent/tool-registry";
import {
  findEntry,
  searchEntries,
  getByFolder,
  getAllEntries,
} from "../data/file-engine";
import { EntryIndex } from "../data/index-types";
import { logger } from "../utils/logger";

/** 将 statusChar 映射为可读状态 */
function statusCharToLabel(sc: string): string {
  const map: Record<string, string> = {
    " ": "待处理",
    "~": "进行中",
    x: "已完成",
    "-": "搁置",
    "?": "待确认",
  };
  return map[sc] || "未知";
}

/** 序列化条目为 AI 友好的精简格式 */
function serializeEntry(e: EntryIndex): Record<string, unknown> {
  return {
    id: e.id,
    title: e.title,
    url: e.url,
    status: e.customStatus,
    statusCategory: statusCharToLabel(e.statusChar),
    interest: e.interest,
    progress: e.progress,
    deadline: e.deadline,
    note: e.note,
    importance: e.importance,
    folderPath: e.folderPath,
    fileName: e.fileName,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function queryEntriesTool(): ToolHandler {
  return {
    definition: {
      type: "function",
      function: {
        name: "find_entries",
        description:
          "搜索/查询条目。支持按标题关键词模糊搜索、按文件夹过滤、按状态筛选。可获取列表或单条详情。",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "标题关键词模糊搜索。留空则返回指定文件夹下所有条目。",
            },
            folderPath: {
              type: "string",
              description: "按文件夹路径过滤，如 '娱乐'、'工作'。留空则搜索全部。",
            },
            statusFilter: {
              type: "string",
              enum: ["待处理", "进行中", "已完成", "搁置"],
              description: "按状态分类筛选",
            },
            includeDetail: {
              type: "boolean",
              description: "是否包含完整详情（url、备注、截止时间等）。默认 false 仅返回摘要。",
            },
            limit: {
              type: "number",
              description: "最多返回条数，默认 20。",
            },
          },
        },
      },
    },
    async execute(args: Record<string, unknown>, userId: string) {
      const query = (args.query as string) || "";
      const folderPath = (args.folderPath as string) || "";
      const statusFilter = (args.statusFilter as string) || "";
      const includeDetail = (args.includeDetail as boolean) || false;
      const limit = (args.limit as number) || 20;

      try {
        let results: EntryIndex[];

        if (query) {
          // 先精确查找
          const exact = findEntry(userId, query);
          if (exact) {
            return {
              found: true,
              matchType: "exact",
              count: 1,
              entries: [includeDetail ? serializeEntry(exact) : {
                id: exact.id,
                title: exact.title,
                status: exact.customStatus,
                interest: exact.interest,
                folderPath: exact.folderPath,
                progress: exact.progress,
              }],
            };
          }
          // 模糊搜索
          results = searchEntries(userId, query);
        } else if (folderPath) {
          results = getByFolder(userId, folderPath);
        } else {
          results = getAllEntries(userId);
        }

        // 按文件夹过滤
        if (folderPath && query) {
          results = results.filter(
            (e) =>
              e.folderPath === folderPath ||
              e.folderPath.startsWith(folderPath + "/")
          );
        }

        // 按状态过滤
        if (statusFilter) {
          const statusLabelToChar: Record<string, string> = {
            待处理: " ",
            进行中: "~",
            已完成: "x",
            搁置: "-",
          };
          const targetChar = statusLabelToChar[statusFilter];
          if (targetChar) {
            results = results.filter((e) => e.statusChar === targetChar);
          }
        }

        // 截断
        const total = results.length;
        results = results.slice(0, limit);

        logger.debug(`工具 find_entries`, {
          userId,
          query,
          folderPath,
          total,
          returned: results.length,
        });

        return {
          found: total > 0,
          count: results.length,
          totalCount: total,
          truncated: total > limit,
          entries: results.map((e) =>
            includeDetail
              ? serializeEntry(e)
              : {
                  id: e.id,
                  title: e.title,
                  status: e.customStatus,
                  interest: e.interest,
                  folderPath: e.folderPath,
                  progress: e.progress,
                  deadline: e.deadline,
                }
          ),
        };
      } catch (err) {
        logger.error("工具 find_entries 失败", { error: String(err), userId });
        return { found: false, error: `查询失败：${String(err)}` };
      }
    },
  };
}

toolRegistry.register(queryEntriesTool());
