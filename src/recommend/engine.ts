/**
 * 推荐引擎
 * 场景映射 + 打分排序 + 去重
 */

import { getByFolder } from "../data/file-engine";
import { recordRecommended, isRecentlyRecommended } from "./recommend-record";
import { EntryIndex, RecommendResult } from "../data/index-types";
import { logger } from "../utils/logger";

/** 场景 → 候选文件夹映射 */
const SCENE_FOLDERS: Record<string, string[]> = {
  boredom: ["娱乐"],
  hungry: ["美食"],
  learn: ["学习", "工作"],
};

/** 计算单条推荐分数 */
function scoreEntry(entry: EntryIndex): number {
  const interestScore = entry.interest / 100;
  const createdAt = entry.createdAt ? new Date(entry.createdAt) : new Date();
  const daysOld = Math.max(0, (Date.now() - createdAt.getTime()) / 86400000);
  const freshnessScore = Math.max(0, 1 - daysOld / 30);
  const varietyScore = 1; // 默认满分，由去重逻辑处理

  return interestScore * 0.6 + freshnessScore * 0.2 + varietyScore * 0.2;
}

/** 推荐入口 */
export function recommend(userId: string, scene: string, count = 3): RecommendResult[] {
  const folders = SCENE_FOLDERS[scene] || [];
  if (folders.length === 0) return [];

  // 收集候选条目
  let candidates: EntryIndex[] = [];
  for (const folder of folders) {
    const entries = getByFolder(userId, folder);
    candidates.push(...entries);
  }

  // 过滤
  candidates = candidates.filter((e) => {
    if (["x", "-"].includes(e.statusChar)) return false;
    if (e.interest < 30) return false;
    return true;
  });

  // 去重：30 分钟内推荐过的跳过
  candidates = candidates.filter((e) => !isRecentlyRecommended(userId, e.id, 30 * 60 * 1000));

  // 打分排序
  const scored: RecommendResult[] = candidates.map((entry) => ({
    entry,
    score: scoreEntry(entry),
  }));
  scored.sort((a, b) => b.score - a.score);

  const results = scored.slice(0, count);

  // 记录推荐
  for (const r of results) {
    recordRecommended(userId, r.entry.id);
  }

  logger.debug(`推荐结果`, { userId, scene, candidates: candidates.length, returned: results.length });
  return results;
}
