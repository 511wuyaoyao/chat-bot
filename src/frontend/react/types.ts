/**
 * Debug React 前端使用的接口类型。
 */

export type DebugView = "traces" | "sessions" | "status" | "config";
export type ConfigDraft = Record<string, ConfigDraftValue | null>;
export type ConfigMessage = { kind: "ok" | "error"; text: string };

export interface VisibilityFilters {
  hideSource: boolean;
  hideTools: boolean;
  hideDeleted: boolean;
  hideTopic: boolean;
}

export interface DebugTrace {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  actor?: string;
  userId?: string;
  sessionId?: string;
  mainSessionId?: string;
  round?: number;
  model?: string;
  params?: Record<string, unknown>;
  messages?: DebugMessage[];
  tools?: unknown[];
  status?: "pending" | "completed" | "failed" | string;
  response?: unknown;
  error?: string;
  finishReason?: string | null;
  usage?: unknown;
  events?: Array<{ type: string; createdAt: string; data?: unknown }>;
  [key: string]: unknown;
}

export interface DebugMessage {
  role?: string;
  content?: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
  topic?: string;
  deleted?: boolean;
  deletedReason?: string;
  deletedAt?: string;
  compactionLayer?: 1 | 2 | 3;
  name?: string;
  tool_calls?: unknown;
  tool_call_id?: string;
  [key: string]: unknown;
}

export interface DebugSessionActorSummary {
  actor: "main" | "topic" | "exec";
  messageCount: number | null;
  activeMessageCount?: number | null;
  deletedCount: number | null;
  updatedAt: number | null;
  contextSize: number;
  contextPath: string;
}

export interface DebugSession {
  personId: string;
  userId?: string;
  sessionId: string;
  isCurrent?: boolean;
  totalMessageCount?: number;
  activeMessageCount?: number;
  deletedMessageCount?: number;
  updatedAt?: number | null;
  actors?: DebugSessionActorSummary[];
  messageCount?: number;
  messages?: DebugMessage[];
  [key: string]: unknown;
}

export interface DebugSessionDetail extends DebugSessionActorSummary {
  personId: string;
  userId?: string;
  sessionId: string;
  messages: DebugMessage[];
}

export type DebugSessionList = DebugSession[];

export interface DebugStatus {
  adapter?: string;
  uptimeSeconds?: number;
  memoryRss?: number;
  traceCount?: number;
  tokenCount?: number;
  errorRate?: number;
  [key: string]: unknown;
}

export interface DebugConfigGroup {
  id?: string;
  key?: string;
  label: string;
}

export interface DebugConfigOption {
  label: string;
  value: string;
}

export interface DebugConfigField {
  key: string;
  label: string;
  group: string;
  type: "string" | "number" | "boolean" | "stringList" | "json" | "select" | "secretStatus";
  value: ConfigDraftValue | null;
  editable: boolean;
  sensitive: boolean;
  description?: string;
  min?: number;
  max?: number;
  options?: DebugConfigOption[];
  configured?: boolean;
}

export type ConfigDraftValue = string | number | boolean | string[];

export interface DebugConfigState {
  groups: DebugConfigGroup[];
  fields: DebugConfigField[];
  readOnlyStatus: Record<string, unknown>;
  validationErrors: string[];
  errors?: Record<string, string>;
}

export interface QQUserAccountDraft {
  platform: "napcat" | "qqbot-official";
  id: string;
  label?: string;
}

export interface QQUserDraft {
  id: string;
  name?: string;
  accounts: QQUserAccountDraft[];
  primaryAccount: QQUserAccountDraft;
  fields?: Record<string, unknown>;
}
