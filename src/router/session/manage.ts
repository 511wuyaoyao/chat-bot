/**
 * 会话生命周期管理
 */

const sessions = new Map<string, string>();

/** 获取或创建当前活跃会话 */
export function getOrCreateSession(userId: string): string {
  let sid = sessions.get(userId);
  if (!sid) {
    sid = `${userId}_${Date.now()}`;
    sessions.set(userId, sid);
  }
  return sid;
}

/** 切换活跃会话 */
export function switchSession(userId: string, sid: string): void {
  sessions.set(userId, sid);
}
