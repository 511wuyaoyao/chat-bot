/**
 * 文件消息段渲染器
 * 将 file 消息段转换为文件占位文本。
 */

import { MessageSegmentRenderer } from "../types";

export const fileSegmentRenderer: MessageSegmentRenderer = {
  type: "file",
  render(segment) {
    return `[文件:${String(segment.data?.name ?? segment.data?.file ?? "")}]`;
  },
};
