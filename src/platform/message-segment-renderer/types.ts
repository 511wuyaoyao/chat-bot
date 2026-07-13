/**
 * QQ 消息段转文本类型
 * 定义 OneBot 消息段和消息段渲染处理器接口。
 */

export interface OneBotMessageSegment {
  type?: string;
  data?: Record<string, unknown>;
}

export interface MessageSegmentRenderContext {
  renderSegments: (rawSegments: unknown) => Promise<string>;
  onImageRecognitionStart?: () => void | Promise<void>;
  onTokenUsage?: (actor: string, usage: unknown) => void | Promise<void>;
}

export interface MessageSegmentRenderer {
  type: string;
  render(segment: OneBotMessageSegment, context: MessageSegmentRenderContext): string | Promise<string>;
}
