/**
 * deepseek_web_search 工具
 * 调用 DeepSeek Anthropic 端点的服务端搜索，DeepSeek 自动搜索并总结
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { config } from "../../config";
import { logger } from "../../utils/logger";

function webSearchTool(): ToolHandler {
  return {
    definition: {
      type: "function",
      function: {
        name: "deepseek_web_search",
        description:
          "使用 DeepSeek 服务端搜索获取实时信息并总结。适合主对话中需要结合上下文的联网回答。",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "搜索需求或问题。如 '深圳今天天气'、'这个 API 免费吗'",
            },
            context: {
              type: "string",
              description: "可选的简短对话上下文，用于消解 '这个 API'、'它' 等指代。不要传整段长历史。",
            },
          },
          required: ["query"],
        },
      },
    },
    async execute(args: Record<string, unknown>, _userId: string) {
      const query = String(args.query || "").trim();
      const context = String(args.context || "").trim();
      if (!query) {
        return { success: false, error: "搜索关键词不能为空" };
      }

      try {
        logger.debug("deepseek_web_search 执行", { query, hasContext: Boolean(context) });

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
            system:
              "你是联网搜索工具。请根据用户问题调用 web_search 获取信息，并只输出最终答案。" +
              "不要输出任何工具调用、XML、DSML、JSON、内部标记或推理过程。" +
              "回答要简洁，必要时列出来源标题和链接。" +
              "如果搜索结果不足，请说明无法确认，不要编造。",
            messages: [
              {
                role: "user",
                content: context
                  ? `上下文：${context}\n\n搜索需求：${query}`
                  : `搜索需求：${query}`,
              },
            ],
            tools: [{ type: "web_search_20250305", name: "web_search" }],
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          logger.error("deepseek_web_search API 失败", { status: res.status, body: errBody });
          return { success: false, error: `搜索请求失败: ${res.status}` };
        }

        const data: any = await res.json();

        const textBlock = data.content?.find((c: any) => c.type === "text");
        const resultText = textBlock?.text || "";

        const searchResult = data.content?.find((c: any) => c.type === "web_search_tool_result");
        const sources =
          searchResult?.content
            ?.filter((c: any) => c.type === "web_search_result")
            .map((c: any) => ({ title: c.title, url: c.url })) || [];

        logger.debug("deepseek_web_search 完成", {
          query,
          hasContext: Boolean(context),
          resultLen: resultText.length,
          sources: sources.length,
        });

        return {
          success: true,
          query,
          context: context || undefined,
          result: resultText,
          sources,
        };
      } catch (err) {
        logger.error("deepseek_web_search 异常", { error: String(err), query });
        return { success: false, error: `搜索异常: ${String(err)}` };
      }
    },
  };
}

toolRegistry.register(webSearchTool());
