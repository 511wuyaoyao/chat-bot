/**
 * 定时器类型定义
 * 纯接口，不依赖任何模块
 */

/** 定时任务条目 */
export interface ScheduleEntry {
  id: string;                  // 唯一 ID
  type: "recurring" | "once"; // recurring=定时任务(可重复) once=一次任务(触发即完成)
  entryTitle: string;          // 关联的条目标题
  triggerAt: string;           // 触发时间 YYYY-MM-DD HH:mm
  message?: string;            // 自定义提醒文案，不填则自动生成
  repeatRule?: string;         // daily:HH:mm | weekly:D:HH:mm（D: 0=周日 1=周一…）
  enabled: boolean;            // 是否启用，false=暂停
  mutedUntil?: string;         // 静音截止时间 YYYY-MM-DD HH:mm，到期自动恢复
  lastFiredAt?: string;        // 上次触发时间，undefined=从未触发
  createdAt: string;           // 创建时间 YYYY-MM-DD HH:mm
  [key: string]: unknown;      // 自定义扩展字段
}

/** 消息发送回调 */
export type SendFn = (userId: string, message: string) => Promise<void>;
