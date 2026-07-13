/**
 * QQ 消息段转文本入口
 * 将 OneBot/NapCat 消息段按类型转换为 agent 可读文本。
 */

import { atSegmentRenderer } from "./at";
import { fileSegmentRenderer } from "./file";
import { forwardSegmentRenderer } from "./forward";
import { imageSegmentRenderer } from "./image";
import { recordSegmentRenderer } from "./record";
import { textSegmentRenderer } from "./text";
import { unknownSegmentRenderer } from "./unknown";
import { videoSegmentRenderer } from "./video";
import { MessageSegmentRenderContext, OneBotMessageSegment } from "./types";

type MessageSegmentRenderOptions = Omit<MessageSegmentRenderContext, "renderSegments">;

const renderers = [
  textSegmentRenderer,
  atSegmentRenderer,
  imageSegmentRenderer,
  recordSegmentRenderer,
  videoSegmentRenderer,
  fileSegmentRenderer,
  forwardSegmentRenderer,
];

export async function renderMessageSegmentsToText(
  rawSegments: unknown,
  options: MessageSegmentRenderOptions = {}
): Promise<string> {
  return renderSegments(rawSegments, createRenderContext(options));
}

async function renderSegments(rawSegments: unknown, context: MessageSegmentRenderContext): Promise<string> {
  const parts = await Promise.all(
    normalizeMessageSegments(rawSegments).map((segment) => {
      const renderer = renderers.find((item) => item.type === segment.type);
      return (renderer ?? unknownSegmentRenderer).render(segment, context);
    })
  );
  return parts.join("");
}

function createRenderContext(options: MessageSegmentRenderOptions = {}): MessageSegmentRenderContext {
  const context: MessageSegmentRenderContext = {
    ...options,
    renderSegments: (rawSegments) => renderSegments(rawSegments, context),
  };
  return context;
}

export function normalizeMessageSegments(rawSegments: unknown): OneBotMessageSegment[] {
  if (!Array.isArray(rawSegments)) return [];

  return rawSegments
    .filter((segment): segment is Record<string, unknown> => Boolean(segment) && typeof segment === "object")
    .map((segment) => ({
      type: typeof segment.type === "string" ? segment.type : undefined,
      data: segment.data && typeof segment.data === "object"
        ? segment.data as Record<string, unknown>
        : undefined,
    }));
}

export type { MessageSegmentRenderContext, OneBotMessageSegment } from "./types";
