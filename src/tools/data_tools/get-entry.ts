/**
 * get_entry — 读取文件内容
 */

import { toolRegistry } from "../../agent/tool-registry";
import { readFile } from "./data_engine/file-engine";

toolRegistry.register({
  definition: {
    type: "function",
    function: {
      name: "get_entry",
      description:
        "读取一个 .md 文件的完整内容，查看其中所有条目的详细字段。" +
        "先用 get_tree 浏览目录，发现需要的文件后，用此工具读取全文。",
      parameters: {
        type: "object",
        properties: {
          folderPath: { type: "string", description: "文件所在的分类路径，如 娱乐、学习/课程" },
          fileName: { type: "string", description: "文件名，如 电影、自媒体（不含 .md）" },
        },
        required: ["folderPath", "fileName"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const folderPath = String(args.folderPath);
    const fileName = String(args.fileName) + ".md";
    const content = readFile(userId, folderPath, fileName);
    if (!content) {
      return { success: false, error: `文件不存在或为空：${folderPath}/${fileName}` };
    }
    return { success: true, folderPath, fileName, content };
  },
});
