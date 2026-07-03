/**
 * tavily_search 工具
 * 调用 Tavily Search API 进行网页搜索，可按需返回关联图片
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { config } from "../../config";
import { logger } from "../../utils/logger";

type TavilySearchDepth = "basic" | "advanced";
type TavilyTopic = "general" | "news";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  published_date?: string;
}

interface TavilyImage {
  url?: string;
  description?: string;
}

function toPositiveInt(value: unknown, fallback: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

function toSearchDepth(value: unknown): TavilySearchDepth {
  return value === "advanced" ? "advanced" : "basic";
}

function toTopic(value: unknown): TavilyTopic {
  return value === "news" ? "news" : "general";
}

function tavilySearchTool(): ToolHandler {
  return {
    definition: {
      type: "function",
      function: {
        name: "tavily_search",
        description:
          "使用 Tavily 进行联网搜索，可返回网页结果和关联图片。适合需要来源链接、实时资料、或用户要求搜索时附带图片的场景。",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "搜索关键词或问题。如 'Tavily API 图片搜索'、'赛博朋克城市参考图'",
            },
            includeImages: {
              type: "boolean",
              description: "是否返回关联图片。用户要求找图、参考图、配图时设为 true。",
            },
            maxResults: {
              type: "number",
              description: "最多返回网页结果数量，默认 5，最大 10。",
            },
            searchDepth: {
              type: "string",
              enum: ["basic", "advanced"],
              description: "搜索深度，默认 basic。复杂调研可用 advanced。",
            },
            topic: {
              type: "string",
              enum: ["general", "news"],
              description: "搜索主题，默认 general。新闻类实时问题可用 news。",
            },
          },
          required: ["query"],
        },
      },
    },
    async execute(args: Record<string, unknown>, _userId: string) {
      const query = String(args.query || "").trim();
      const includeImages = toBoolean(args.includeImages, false);
      const maxResults = toPositiveInt(args.maxResults, 5, 10);
      const searchDepth = toSearchDepth(args.searchDepth);
      const topic = toTopic(args.topic);

      if (!query) {
        return { success: false, error: "搜索关键词不能为空" };
      }

      if (!config.tavily.apiKey) {
        return { success: false, error: "TAVILY_API_KEY 未设置，无法调用 Tavily 搜索" };
      }

      try {
        logger.debug("tavily_search 执行", {
          query,
          includeImages,
          maxResults,
          searchDepth,
          topic,
        });

        const res = await fetch(`${config.tavily.baseUrl}/search`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.tavily.apiKey}`,
          },
          body: JSON.stringify({
            query,
            search_depth: searchDepth,
            topic,
            max_results: maxResults,
            include_answer: true,
            include_images: includeImages,
            include_image_descriptions: includeImages,
            safe_search: true,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text();
          logger.error("tavily_search API 失败", { status: res.status, body: errBody });
          return { success: false, error: `Tavily 搜索请求失败: ${res.status}` };
        }

        const data: any = await res.json();
        const results = Array.isArray(data.results)
          ? data.results.map((item: TavilyResult) => ({
              title: item.title || "",
              url: item.url || "",
              content: item.content || "",
              score: item.score,
              publishedDate: item.published_date,
            }))
          : [];
        const images = Array.isArray(data.images)
          ? data.images.map((item: TavilyImage | string) =>
              typeof item === "string"
                ? { url: item, description: "" }
                : { url: item.url || "", description: item.description || "" }
            )
          : [];

        logger.debug("tavily_search 完成", {
          query,
          results: results.length,
          images: images.length,
        });

        return {
          success: true,
          query,
          answer: data.answer || "",
          results,
          images,
        };
      } catch (err) {
        logger.error("tavily_search 异常", { error: String(err), query });
        return { success: false, error: `Tavily 搜索异常: ${String(err)}` };
      }
    },
  };
}

toolRegistry.register(tavilySearchTool());
