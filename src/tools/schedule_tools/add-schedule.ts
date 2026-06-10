/**
 * add_schedule — 创建定时任务
 */

import { toolRegistry } from "../../agent/tool-registry";
import { addSchedule } from "./schedule_engine/schedule-engine";
import { nowLocal } from "../../utils/time-utils";
import { TOOL_GUIDE_SCHEDULE } from "../../messages";

toolRegistry.register({
  usageGuide: TOOL_GUIDE_SCHEDULE,
  definition: {
    type: "function",
    function: {
      name: "add_schedule",
      description:
        "创建一个定时提醒或截止日期。fields 为自由键值对，模型自行决定扩展字段。",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "唯一 ID，如 {条目标题}_rem" },
          type: { type: "string", enum: ["recurring", "once"], description: "recurring=定时任务(可重复) once=一次任务" },
          entryTitle: { type: "string", description: "关联的条目标题" },
          triggerAt: { type: "string", description: "触发时间 YYYY-MM-DD HH:mm" },
          message: { type: "string", description: "自定义提醒文案，可选" },
          repeatRule: { type: "string", description: "daily:HH:mm | weekly:D:HH:mm（D: 0=周日），可选" },
          mutedUntil: { type: "string", description: "暂时静音截止时间，可选" },
          fields: { type: "object", description: "自定义扩展键值对，可选" },
        },
        required: ["id", "type", "entryTitle", "triggerAt"],
      },
    },
  },
  async execute(args: Record<string, unknown>, userId: string) {
    const fields = (args.fields as Record<string, unknown>) || {};
    const entry: Record<string, unknown> = {
      id: String(args.id),
      type: String(args.type),
      entryTitle: String(args.entryTitle),
      triggerAt: String(args.triggerAt),
      enabled: true,
      createdAt: nowLocal(),
      ...fields,
    };
    if (args.message) entry.message = args.message;
    if (args.repeatRule) entry.repeatRule = args.repeatRule;
    if (args.mutedUntil) entry.mutedUntil = args.mutedUntil;

    const ok = addSchedule(userId, entry as any);
    return ok
      ? { success: true, id: entry.id }
      : { success: false, error: `创建失败（ID 重复）：${entry.id}` };
  },
});
