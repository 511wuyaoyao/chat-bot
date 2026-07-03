/**
 * 视频消息段渲染器
 * 将 video 消息段转换为视频占位文本。
 */

import { MessageSegmentRenderer } from "../types";

export const videoSegmentRenderer: MessageSegmentRenderer = {
  type: "video",
  render() {
    return "[视频]";
  },
};
