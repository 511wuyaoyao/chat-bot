/**
 * 时间工具函数
 * 时间解析、格式化、日期差值计算
 */

/** 格式化 ISO 时间为人类可读 */
export function formatRemindAt(iso: string): string {
  const target = new Date(iso);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);

  if (diffMin <= 0) return "现在";
  if (diffMin < 60) return `${diffMin}分钟后`;
  if (diffMin < 1440) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m > 0 ? `${h}小时${m}分钟后` : `${h}小时后`;
  }
  const d = Math.floor(diffMin / 1440);
  return `${d}天后`;
}

/** 计算两个日期相差天数 */
export function daysBetween(a: string, b: string): number {
  const da = new Date(a.slice(0, 10));
  const db = new Date(b.slice(0, 10));
  return Math.floor((db.getTime() - da.getTime()) / 86400000);
}

/** 获取今天的日期字符串 YYYY-MM-DD */
export function todayStr(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 获取本地时间字符串 YYYY-MM-DD HH:MM */
export function nowLocal(d?: Date): string {
  const t = d || new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`;
}

/** 获取当前本地时间字符串 YYYY-MM-DD HH:MM:SS */
export function nowISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
