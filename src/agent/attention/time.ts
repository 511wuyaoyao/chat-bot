/**
 * 当前时间上下文
 */

import { nowLocal } from "../../utils/time-utils";

export function timeContext(): string {
  return `当前时间：${nowLocal().slice(0, 16)}`;
}
