/**
 * 语音消息段渲染器
 * 将 record 消息段转换为语音占位文本。
 */

import { MessageSegmentRenderer } from "../types";

export const recordSegmentRenderer: MessageSegmentRenderer = {
  type: "record",
  render() {
    return "[语音]";
  },
};
