/**
 * 未知消息段渲染器
 * 将未显式支持的消息段转换为类型占位文本。
 */

import { MessageSegmentRenderer } from "../types";

export const unknownSegmentRenderer: MessageSegmentRenderer = {
  type: "unknown",
  render(segment) {
    return segment.type ? `[${segment.type}]` : "";
  },
};
