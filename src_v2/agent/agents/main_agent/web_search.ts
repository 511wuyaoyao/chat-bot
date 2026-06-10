/**
 * web_search — 主 Agent 直接持有的搜索工具
 * 复用现有 DeepSeek 服务端搜索逻辑
 */

import { config } from "../../../../src/config";
import { logger } from "../../../../src/utils/logger";
import type { ToolDefinition } from "../../../../src/agent/tool-registry";

export const webSearchDef: ToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description: "搜索网页获取实时信息。当用户询问天气、新闻、实时数据、百科知识等需要联网查找的内容时调用。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
      },
      required: ["query"],
    },
  },
};

export async function webSearchExec(args: Record<string, unknown>) {
  const query = String(args.query);
  try {
    logger.debug(`web_search 执行`, { query });

    const res = await fetch("https://api.deepseek.com/anthropic/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.deepseek.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.deepseek.model,
        max_tokens: 2048,
        messages: [{ role: "user", content: `搜索: ${query}` }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    if (!res.ok) {
      return { success: false, error: `搜索请求失败: ${res.status}` };
    }

    const data: any = await res.json();
    const textBlock = data.content?.find((c: any) => c.type === "text");
    const resultText = textBlock?.text || "";

    const searchResult = data.content?.find((c: any) => c.type === "web_search_tool_result");
    const sources = searchResult?.content
      ?.filter((c: any) => c.type === "web_search_result")
      .map((c: any) => ({ title: c.title, url: c.url })) || [];

    return { success: true, query, result: resultText, sources };
  } catch (err) {
    logger.error("web_search 异常", { error: String(err), query });
    return { success: false, error: `搜索异常: ${String(err)}` };
  }
}
