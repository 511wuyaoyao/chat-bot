/**
 * query_schedules — 查询定时任务
 */

import { toolRegistry } from "../../agent/tool-registry";
import { listSchedules, getSchedule } from "./schedule_engine/schedule-engine";
import { TOOL_GUIDE_SCHEDULE } from "../../messages";

toolRegistry.register({
  usageGuide: TOOL_GUIDE_SCHEDULE,
  definition: {
    type: "function",
    function: {
      name: "query_schedules",
      description: "查询定时任务列表或单个任务。不传 id 返回全部。",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "任务 ID，可选。不传则返回全部" },
        },
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const id = args.id as string | undefined;
    if (id) {
      const entry = getSchedule(userId, id);
      return entry
        ? { success: true, schedule: entry }
        : { success: false, error: `找不到任务：${id}` };
    }
    return { success: true, schedules: listSchedules(userId) };
  },
});
