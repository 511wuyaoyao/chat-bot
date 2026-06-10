/**
 * update_folder — 更新分类（改名 / 改描述）
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { updateFolder } from "./data_engine/file-engine";

toolRegistry.register({
  definition: {
    type: "function",
    function: {
      name: "update_folder",
      description: "更新分类：改名 或 修改描述文字。",
      parameters: {
        type: "object",
        properties: {
          folderPath: { type: "string", description: "当前分类路径" },
          newName: { type: "string", description: "新的分类名称（改名）" },
          description: { type: "string", description: "新的描述文字" },
        },
        required: ["folderPath"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const folderPath = String(args.folderPath);
    const changes: { name?: string; description?: string } = {};
    if (args.newName) changes.name = args.newName as string;
    if (args.description !== undefined) changes.description = args.description as string;
    if (!changes.name && changes.description === undefined) {
      return { success: false, error: "请指定 newName 或 description" };
    }
    const ok = updateFolder(userId, folderPath, changes);
    return ok
      ? { success: true, folderPath }
      : { success: false, error: `更新失败：${folderPath}` };
  },
});
