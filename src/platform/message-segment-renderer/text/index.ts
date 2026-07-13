/**
 * 文本消息段渲染器
 * 将 text 消息段转换为原始文本。
 */

import { MessageSegmentRenderer } from "../types";

export const textSegmentRenderer: MessageSegmentRenderer = {
  type: "text",
  render(segment) {
    return String(segment.data?.text ?? "");
  },
};
