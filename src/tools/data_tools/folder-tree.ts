/**
 * get_tree — 查看目录结构
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { scanTree } from "./data_engine/file-engine";

toolRegistry.register({
  definition: {
    type: "function",
    function: {
      name: "get_tree",
      description: "查看用户的数据目录结构。返回树状文本，含文件夹描述、文件条目数、标题预览。",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  async execute(_args: Record<string, unknown>, userId: string) {
    const text = scanTree(userId);
    return { success: true, tree: text || "暂无数据" };
  },
});
