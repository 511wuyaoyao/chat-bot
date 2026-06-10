/**
 * delete_schedule — 删除定时任务
 */

import { toolRegistry } from "../../agent/tool-registry";
import { removeSchedule } from "./schedule_engine/schedule-engine";
import { TOOL_GUIDE_SCHEDULE } from "../../messages";

toolRegistry.register({
  usageGuide: TOOL_GUIDE_SCHEDULE,
  definition: {
    type: "function",
    function: {
      name: "delete_schedule",
      description: "删除一个定时任务，不可逆。",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "任务 ID，必填" },
        },
        required: ["id"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const id = String(args.id);
    const ok = removeSchedule(userId, id);
    return ok
      ? { success: true, id }
      : { success: false, error: `找不到任务：${id}` };
  },
});
