/**
 * NapCat 原始事件到 OneBot11 协议事件的转换入口。
 * NapCat 在某些事件（尤其是撤回通知）中可能使用与 OneBot v11 标准不一致的字段名，
 * 此处做统一规范化处理，确保下游代码始终拿到标准字段名。
 */

import type { OneBot11IncomingEvent } from "../../protocol/onebot11";

export function napcatRawEventToOneBot11(rawEvent: unknown): OneBot11IncomingEvent | null {
  if (!rawEvent || typeof rawEvent !== "object") return null;

  const src = rawEvent as Record<string, unknown>;

  // 规范化 message_id：NapCat 撤回事件中可能使用 msg_id / msg_seq 等字段名
  if (src.message_id === undefined || src.message_id === null || Number(src.message_id) === 0) {
    const fallback = src.msg_id ?? src.msg_seq ?? src.message_seq ?? src.seq;
    if (fallback !== undefined && fallback !== null && Number(fallback) !== 0) {
      src.message_id = fallback;
    }
  }

  // 规范化 user_id
  if (src.user_id === undefined || src.user_id === null) {
    const fallback = src.sender_uin ?? src.sender_id ?? src.from_uin;
    if (fallback !== undefined && fallback !== null) {
      src.user_id = fallback;
    }
  }

  // 规范化 group_id
  if (src.group_id === undefined || src.group_id === null) {
    const fallback = src.group_code ?? src.peer_uid;
    if (fallback !== undefined && fallback !== null) {
      src.group_id = fallback;
    }
  }

  // 规范化 operator_id（撤回操作者）
  if (src.operator_id === undefined || src.operator_id === null) {
    const fallback = src.operator_uin ?? src.admin_uin;
    if (fallback !== undefined && fallback !== null) {
      src.operator_id = fallback;
    }
  }

  return src as unknown as OneBot11IncomingEvent;
}
