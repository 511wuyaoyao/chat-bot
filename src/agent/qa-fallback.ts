/**
 * 兜底 QA 回复
 * 仅在 Agent Loop 完全失败时调用
 */

import { getLlmClient } from "./llm-client";
import { config } from "../config/output";
import { logger } from "../utils/logger";
import { QA_FALLBACK_PROMPT, FALLBACK_CANNOT_RESPOND } from "../prompt";
import { StoredMessage } from "../router/session/utils/types";

export async function qaFallback(
  text: string,
  context: StoredMessage[]
): Promise<string> {
  const client = getLlmClient();

  try {
    const response = await client.chat.completions.create({
      model: config.deepseek.model,
      messages: [
        { role: "system", content: QA_FALLBACK_PROMPT },
        ...context
          .filter((c) => c.role === "user" || c.role === "assistant")
          .map((c) => ({ role: c.role as "user" | "assistant", content: c.content || "" })),
        { role: "user", content: text },
      ],
      temperature: 0.7,
      max_tokens: 256,
      // 兜底模式不需要思考，避免 reasoning_content 引发的 400
      thinking: { type: "disabled" },
    } as any);
    return response.choices[0]?.message?.content || FALLBACK_CANNOT_RESPOND;
  } catch (err) {
    logger.error("兜底 QA 也失败了", { error: String(err) });
    return FALLBACK_CANNOT_RESPOND;
  }
}

