/**
 * create_folder — 创建分类
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { createFolder } from "./data_engine/file-engine";

toolRegistry.register({
  definition: {
    type: "function",
    function: {
      name: "create_folder",
      description: "创建一个新的分类文件夹。会自动生成 README.md 描述文件。",
      parameters: {
        type: "object",
        properties: {
          folderPath: { type: "string", description: "分类路径，如 娱乐/电影、学习" },
          description: { type: "string", description: "该分类的描述/用途说明" },
        },
        required: ["folderPath"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const folderPath = String(args.folderPath);
    const desc = args.description as string | undefined;
    const ok = createFolder(userId, folderPath, desc);
    return ok
      ? { success: true, folderPath }
      : { success: false, error: `创建失败（可能已存在）：${folderPath}` };
  },
});
