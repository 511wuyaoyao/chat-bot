/**
 * 推荐记录管理
 * 记录推荐历史，用于去重
 */

const recommendHistory = new Map<string, Map<string, number>>();

function userHistory(userId: string): Map<string, number> {
  if (!recommendHistory.has(userId)) {
    recommendHistory.set(userId, new Map());
  }
  return recommendHistory.get(userId)!;
}

/** 记录推荐 */
export function recordRecommended(userId: string, entryId: string): void {
  userHistory(userId).set(entryId, Date.now());
}

/** 检查是否在窗口内推荐过 */
export function isRecentlyRecommended(userId: string, entryId: string, windowMs: number): boolean {
  const lastTime = userHistory(userId).get(entryId);
  if (!lastTime) return false;
  return Date.now() - lastTime < windowMs;
}

/** 清除用户的推荐历史 */
export function clearRecommendHistory(userId: string): void {
  recommendHistory.delete(userId);
}
