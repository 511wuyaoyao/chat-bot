/**
 * delete_file — 删除文件
 */

import { toolRegistry } from "../../agent/tool-registry";
import { deleteFile } from "./data_engine/file-engine";

toolRegistry.register({
  definition: {
    type: "function",
    function: {
      name: "delete_file",
      description: "删除一个 .md 文件（用于清空后的空文件或不再需要的文件）。不可逆。",
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
    const ok = deleteFile(userId, folderPath, fileName);
    return ok
      ? { success: true, folderPath, fileName }
      : { success: false, error: `文件不存在：${folderPath}/${fileName}` };
  },
});
