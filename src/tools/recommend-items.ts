/**
 * recommend_items 工具
 * 根据场景推荐内容：无聊→娱乐、饿了→美食、想学习→学习/工作
 */

import { toolRegistry, ToolHandler } from "../agent/tool-registry";
import { recommend } from "../recommend/engine";
import { logger } from "../utils/logger";
import { SCENE_LABELS, SCENE_EMPTY_RECOMMEND } from "../messages";

function recommendItemsTool(): ToolHandler {
  return {
    definition: {
      type: "function",
      function: {
        name: "recommend_items",
        description:
          "根据场景推荐内容。boredom=无聊时推荐娱乐（综艺/电影/游戏），hungry=饿了推荐美食（餐厅/菜谱），learn=想学习推荐学习资料。",
        parameters: {
          type: "object",
          properties: {
            scene: {
              type: "string",
              enum: ["boredom", "hungry", "learn"],
              description: "场景：boredom（无聊）、hungry（饿了/想吃）、learn（想学/学习）",
            },
            count: {
              type: "number",
              description: "推荐数量，默认 3，最大 5。",
            },
          },
          required: ["scene"],
        },
      },
    },
    async execute(args: Record<string, unknown>, userId: string) {
      const scene = String(args.scene);
      const count = Math.min((args.count as number) || 3, 5);

      try {
        const results = recommend(userId, scene, count);

        logger.debug(`工具 recommend_items`, {
          userId,
          scene,
          requested: count,
          returned: results.length,
        });

        if (results.length === 0) {
          return {
            success: true,
            count: 0,
            message: SCENE_EMPTY_RECOMMEND,
            items: [],
          };
        }

        return {
          success: true,
          count: results.length,
          items: results.map((r) => ({
            id: r.entry.id,
            title: r.entry.title,
            url: r.entry.url,
            status: r.entry.customStatus,
            interest: r.entry.interest,
            progress: r.entry.progress,
            folderPath: r.entry.folderPath,
            note: r.entry.note,
            score: Math.round(r.score * 100) / 100,
          })),
        };
      } catch (err) {
        logger.error("工具 recommend_items 失败", { error: String(err), userId });
        return { success: false, error: `推荐失败：${String(err)}` };
      }
    },
  };
}

toolRegistry.register(recommendItemsTool());
