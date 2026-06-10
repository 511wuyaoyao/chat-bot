/**
 * update_schedule — 更新定时任务
 */

import { toolRegistry } from "../../agent/tool-registry";
import { updateSchedule, setEnabled, setMuted } from "./schedule_engine/schedule-engine";
import { TOOL_GUIDE_SCHEDULE } from "../../messages";

toolRegistry.register({
  usageGuide: TOOL_GUIDE_SCHEDULE,
  definition: {
    type: "function",
    function: {
      name: "update_schedule",
      description: "更新定时任务。可改触发时间、调整重复规则、启用/暂停、修改自定义字段等。",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "任务 ID，必填" },
          triggerAt: { type: "string", description: "新触发时间" },
          repeatRule: { type: "string", description: "新重复规则" },
          message: { type: "string", description: "新提醒文案" },
          enabled: { type: "boolean", description: "是否启用" },
          mutedUntil: { type: "string", description: "静音截止时间" },
          fields: { type: "object", description: "要修改的自定义键值对" },
        },
        required: ["id"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const id = String(args.id);
    const changes: Record<string, unknown> = {};

    if (args.triggerAt) changes.triggerAt = args.triggerAt;
    if (args.repeatRule !== undefined) changes.repeatRule = args.repeatRule;
    if (args.message !== undefined) changes.message = args.message;
    if (args.enabled !== undefined) changes.enabled = args.enabled;
    if (args.mutedUntil !== undefined) changes.mutedUntil = args.mutedUntil;

    const fields = args.fields as Record<string, unknown> | undefined;
    if (fields) Object.assign(changes, fields);

    const ok = updateSchedule(userId, id, changes as any);
    return ok
      ? { success: true, id }
      : { success: false, error: `找不到任务：${id}` };
  },
});
