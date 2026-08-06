/**
 * 外部服务配置。
 */

import { defaultAgentModelConfig } from "./agent";

export const serviceConfig = {
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
    model: defaultAgentModelConfig.model,
  },
  tavily: {
    apiKey: process.env.TAVILY_API_KEY || "",
    baseUrl: process.env.TAVILY_BASE_URL || "https://api.tavily.com",
  },
  ark: {
    apiKey: process.env.ARK_API_KEY || "",
    baseUrl: process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3",
    visionModel: process.env.ARK_VISION_MODEL || "doubao-seed-2-1-pro-260628",
  },
};
