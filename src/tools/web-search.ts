/**
 * web_search 工具
 * 调用 DeepSeek Anthropic 端点的服务端搜索，DeepSeek 自动搜索+总结
 * 工具在 OpenAI agent loop 中以普通 tool 注册，execute 内部走 Anthropic 端点
 */

import { toolRegistry, ToolHandler } from "../agent/tool-registry";
import { config } from "../config";
import { logger } from "../utils/logger";

function webSearchTool(): ToolHandler {
  return {
    definition: {
      type: "function",
      function: {
        name: "web_search",
        description:
          "搜索网页获取实时信息。当用户询问天气、新闻、实时数据、百科知识等需要联网查找的内容时调用。",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "搜索关键词，用中文。如 '深圳今天天气'、'Running Man 综艺介绍'",
            },
          },
          required: ["query"],
        },
      },
    },
    async execute(args: Record<string, unknown>, _userId: string) {
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
          const errBody = await res.text();
          logger.error("web_search API 失败", { status: res.status, body: errBody });
          return { success: false, error: `搜索请求失败: ${res.status}` };
        }

        const data: any = await res.json();

        // 提取文本回复
        const textBlock = data.content?.find((c: any) => c.type === "text");
        const resultText = textBlock?.text || "";

        // 提取引用来源
        const searchResult = data.content?.find((c: any) => c.type === "web_search_tool_result");
        const sources =
          searchResult?.content
            ?.filter((c: any) => c.type === "web_search_result")
            .map((c: any) => ({ title: c.title, url: c.url })) || [];

        logger.debug("web_search 完成", {
          query,
          resultLen: resultText.length,
          sources: sources.length,
        });

        return {
          success: true,
          query,
          result: resultText,
          sources,
        };
      } catch (err) {
        logger.error("web_search 异常", { error: String(err), query });
        return { success: false, error: `搜索异常: ${String(err)}` };
      }
    },
  };
}

toolRegistry.register(webSearchTool());
