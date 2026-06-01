/**
 * 兜底 QA 回复
 * 仅在 Agent Loop 完全失败时调用（API 错误、max iterations 耗尽且无回复等极端情况）
 */

import { getLlmClient } from "./llm-client";
import { config } from "../config";
import { logger } from "../utils/logger";
import { QA_FALLBACK_PROMPT, FALLBACK_CANNOT_RESPOND } from "../messages";

interface ContextEntry {
  role: "user" | "assistant";
  content: string;
}

/**
 * 兜底回复：不使用工具，纯文本回复
 */
export async function qaFallback(
  text: string,
  context: ContextEntry[]
): Promise<string> {
  const client = getLlmClient();

  try {
    const response = await client.chat.completions.create({
      model: config.deepseek.model,
      messages: [
        { role: "system", content: QA_FALLBACK_PROMPT },
        ...context.map((c) => ({
          role: c.role as "user" | "assistant",
          content: c.content,
        })),
        { role: "user", content: text },
      ],
      temperature: 0.7,
      max_tokens: 256,
    });
    return (
      response.choices[0]?.message?.content ||
      FALLBACK_CANNOT_RESPOND
    );
  } catch (err) {
    logger.error("兜底 QA 也失败了", { error: String(err) });
    return FALLBACK_CANNOT_RESPOND;
  }
}
