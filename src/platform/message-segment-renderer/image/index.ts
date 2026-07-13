import { MessageSegmentRenderer } from "../types";
import { describeImage } from "./vision-client";

export const imageSegmentRenderer: MessageSegmentRenderer = {
  type: "image",
  async render(segment, context) {
    const imageUrl = getImageUrl(segment.data);
    if (!imageUrl) return "[图片]";

    await context.onImageRecognitionStart?.();
    const result = await describeImage(imageUrl);
    if (!result) return "[图片]";

    if (result.usage) {
      await context.onTokenUsage?.("vision-image", result.usage);
    }

    return `[图片]\n${result.text}`;
  },
};

function getImageUrl(data?: Record<string, unknown>): string | null {
  const url = data?.url;
  if (typeof url === "string" && url.trim()) return url.trim();

  const file = data?.file;
  if (typeof file === "string" && /^https?:\/\//.test(file)) return file;

  return null;
}
