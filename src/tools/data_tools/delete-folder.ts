/**
 * delete_folder — 删除分类
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { deleteFolder } from "./data_engine/file-engine";

toolRegistry.register({
  definition: {
    type: "function",
    function: {
      name: "delete_folder",
      description: "删除一个分类文件夹及其所有内容。不可逆。",
      parameters: {
        type: "object",
        properties: {
          folderPath: { type: "string", description: "要删除的分类路径" },
        },
        required: ["folderPath"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const folderPath = String(args.folderPath);
    const ok = deleteFolder(userId, folderPath);
    return ok
      ? { success: true, folderPath }
      : { success: false, error: `删除失败（可能不存在）：${folderPath}` };
  },
});
