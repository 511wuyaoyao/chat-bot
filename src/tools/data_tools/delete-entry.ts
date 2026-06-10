/**
 * delete_entry — 删除条目
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { deleteEntry } from "./data_engine/file-engine";

toolRegistry.register({
  definition: {
    type: "function",
    function: {
      name: "delete_entry",
      description: "删除一个条目，按标题匹配。不可逆。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "条目标题，必填" },
        },
        required: ["title"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const title = String(args.title);
    const ok = deleteEntry(userId, title);
    return ok
      ? { success: true, title }
      : { success: false, error: `找不到条目："${title}"` };
  },
});
