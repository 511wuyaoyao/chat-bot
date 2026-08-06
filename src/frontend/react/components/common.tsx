/**
 * Debug React 前端跨页面复用展示组件。
 */

import type { DebugMessage, VisibilityFilters } from "../types";
import { messageContent } from "../utils/view";

export function MessageBlock({ message, filters }: { message?: DebugMessage; filters?: VisibilityFilters }) {
  if (!message) return <div className="message muted">No message</div>;

  const isCompressed = message.deleted === true;
  const topic = typeof message.topic === "string" ? message.topic.trim() : "";
  const isTool = message.role === "tool" || Boolean(message.tool_calls) || Boolean(message.tool_call_id);

  if (filters?.hideTopic && topic) return null;
  if (filters?.hideDeleted && isCompressed) return null;
  if (!isCompressed && filters?.hideTools && isTool) return null;

  return (
    <div className={`message ${isCompressed ? "deleted" : ""} ${roleClass(message.role)}`}>
      <div className="message-role">
        <span>{message.role || "-"}</span>
        <span className="message-badges">
          {topic && <span className="topic-badge">{topic}</span>}
          {isCompressed && (
            <span className="compressed-badge">
              Compressed {message.compactionLayer ? `L${message.compactionLayer}` : "L?"}
              {message.deletedReason ? ` · ${message.deletedReason}` : ""}
            </span>
          )}
        </span>
      </div>
      {!filters?.hideSource && <pre>{JSON.stringify(message, null, 2)}</pre>}
      <div className="message-content">{messageContent(message)}</div>
    </div>
  );
}

export function JsonBlock({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

export function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="status-card">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function roleClass(role?: string): string {
  if (role === "user") return "message-role-user";
  if (role === "assistant") return "message-role-assistant";
  if (role === "system") return "message-role-system";
  if (role === "tool") return "message-role-tool";
  return "message-role-unknown";
}
