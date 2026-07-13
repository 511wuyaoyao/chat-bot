/**
 * @ 消息段渲染器
 * 将 at 消息段转换为 @qq号 文本。
 */

import { MessageSegmentRenderer } from "../types";

export const atSegmentRenderer: MessageSegmentRenderer = {
  type: "at",
  render(segment) {
    return `@${String(segment.data?.qq ?? "")}`;
  },
};
