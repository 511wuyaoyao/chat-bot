/**
 * 状态映射（工具层维护，引擎不关心）
 */

export const STATUS_TO_CHAR: Record<string, string> = {
  "想做": " ", "想看": " ", "想去": " ", "想学": " ", "要做": " ", "想买": " ",
  "已完成": "x", "已看": "x", "已去": "x", "已做": "x", "看过": "x",
  "进行中": "~", "在看": "~", "学习中": "~",
  "搁置": "-", "废弃": "-",
};

export function getStatusChar(status: string): string {
  return STATUS_TO_CHAR[status] || " ";
}
