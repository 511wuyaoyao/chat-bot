/**
 * 模糊匹配工具
 * 按优先级匹配：编号精确 → 标题包含 → 编辑距离≤2
 */

import { EntryIndex } from "../data/index-types";

/** 计算 Levenshtein 编辑距离 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
    }
  }
  return dp[m][n];
}

/** 模糊匹配单条：编号精确 > 标题包含 > 编辑距离≤2 */
export function fuzzyMatch(query: string, candidates: EntryIndex[]): EntryIndex | null {
  if (candidates.length === 0) return null;
  const lower = query.toLowerCase().trim();

  // 1. 编号精确匹配
  const byId = candidates.find((e) => e.id === query);
  if (byId) return byId;

  // 2. 标题包含匹配（精确包含优先）
  const exact = candidates.find((e) => e.title.toLowerCase() === lower);
  if (exact) return exact;

  const contains = candidates.find((e) => e.title.toLowerCase().includes(lower));
  if (contains) return contains;

  // 3. 编辑距离 ≤ 2
  let bestMatch: EntryIndex | null = null;
  let bestDist = Infinity;
  for (const entry of candidates) {
    const dist = levenshtein(lower, entry.title.toLowerCase());
    if (dist <= 2 && dist < bestDist) {
      bestDist = dist;
      bestMatch = entry;
    }
  }

  return bestMatch;
}

/** 模糊搜索多条 */
export function fuzzySearch(query: string, candidates: EntryIndex[]): EntryIndex[] {
  const lower = query.toLowerCase().trim();
  const results: EntryIndex[] = [];

  for (const entry of candidates) {
    const titleLower = entry.title.toLowerCase();
    if (titleLower.includes(lower) || levenshtein(lower, titleLower) <= 2) {
      results.push(entry);
    }
  }

  return results;
}
