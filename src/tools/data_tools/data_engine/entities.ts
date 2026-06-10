/**
 * 文件引擎 v2 — 实体
 */

/** 纯列表条目，没有状态 */
export interface EntryData {
  title: string;
  [key: string]: unknown;
}

/** 有状态追踪的条目（任务、日程） */
export interface TrackableEntry extends EntryData {
  status: string;
  statusChar: string;
  remindAt?: string;
  deadline?: string;
  createdAt?: string;
  repeatRule?: string;
  reminded?: boolean;
}

/** 目录树节点 */
export interface TreeNode {
  name: string;
  isFile: boolean;
  children: TreeNode[];
}

/** 推荐结果 */
export interface RecommendResult {
  entry: TrackableEntry;
  score: number;
}
