/**
 * Debug Traces 页面。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { debugApi } from "../../api";
import type { DebugTrace, VisibilityFilters } from "../../types";
import { JsonBlock, MessageBlock, Meta } from "../../components/common";
import { formatTime } from "../../utils/view";

type TraceSubView = "detail" | "raw";

export function TracePage({ active }: { active: boolean }) {
  const [traces, setTraces] = useState<DebugTrace[]>([]);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [selectedTraceDetail, setSelectedTraceDetail] = useState<DebugTrace | null>(null);
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [traceSubView, setTraceSubView] = useState<TraceSubView>("detail");
  const [filters, setFilters] = useState<VisibilityFilters>({
    hideSource: true,
    hideTools: false,
    hideDeleted: false,
    hideTopic: false,
  });

  const selectedTraceSummary = useMemo(
    () => traces.find((trace) => trace.id === selectedTraceId) || null,
    [selectedTraceId, traces]
  );
  const selectedTrace = selectedTraceDetail ?? selectedTraceSummary;
  const filtered = useMemo(() => traces.filter((trace) =>
    JSON.stringify(trace).toLowerCase().includes(search.toLowerCase())
  ), [search, traces]);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      const nextTraces = await debugApi.traces();
      setTraces(nextTraces);
      if (selectedTraceId && !nextTraces.some((trace) => trace.id === selectedTraceId)) {
        setSelectedTraceId(null);
        setSelectedTraceDetail(null);
      }
    } catch (error) {
      setLoadError(String(error));
    }
  }, [selectedTraceId]);

  const loadTraceDetail = useCallback(async (traceId: string) => {
    try {
      setLoadError(null);
      setSelectedTraceDetail(await debugApi.traceDetail(traceId));
    } catch (error) {
      setLoadError(String(error));
      setSelectedTraceDetail(null);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadData();
    const timer = window.setInterval(() => void loadData(), 3000);
    return () => window.clearInterval(timer);
  }, [active, loadData]);

  useEffect(() => {
    if (!active || !selectedTraceId) return;
    void loadTraceDetail(selectedTraceId);
  }, [active, selectedTraceId, loadTraceDetail]);

  const clearTraces = async () => {
    await debugApi.clearTraces();
    setSelectedTraceId(null);
    setSelectedTraceDetail(null);
    await loadData();
  };

  const toggleFilter = (key: keyof VisibilityFilters) => {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <>
      <div className="toolbar">
        <button onClick={() => void loadData()}>Refresh</button>
        <button onClick={() => void clearTraces()}>Clear Trace</button>
        <button className={filters.hideSource ? "filter-active" : ""} onClick={() => toggleFilter("hideSource")}>Source</button>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filter trace" />
        <div className="spacer" />
      </div>
      {loadError && <div className="inline-error">{loadError}</div>}
      <div className="content two-column">
        <aside>
          {filtered.map((trace) => (
            <button
              key={trace.id}
              className={selectedTraceId === trace.id ? "item active" : "item"}
              onClick={() => {
                setSelectedTraceId(trace.id);
                setSelectedTraceDetail(null);
                setTraceSubView("detail");
              }}
            >
              <b>{trace.actor || "trace"} Round {trace.round ?? "-"}</b>
              <span>{trace.userId || "system"}</span>
              <small>{formatTime(trace.createdAt)}</small>
            </button>
          ))}
        </aside>
        <section>
          {selectedTrace ? (
            <>
              <div className="panel">
                <div className="trace-title-row">
                  <h2>{selectedTrace.actor || "Trace"} · Round {selectedTrace.round ?? "-"}</h2>
                  <div className="subview-tabs">
                    <button className={traceSubView === "detail" ? "active" : ""} onClick={() => setTraceSubView("detail")}>Detail</button>
                    <button className={traceSubView === "raw" ? "active" : ""} onClick={() => setTraceSubView("raw")}>Raw</button>
                  </div>
                </div>
                <div className="meta-grid">
                  <Meta label="ID" value={selectedTrace.id} />
                  <Meta label="Status" value={selectedTrace.status || "-"} />
                  <Meta label="User" value={selectedTrace.userId || "-"} />
                  <Meta label="Session" value={selectedTrace.sessionId || "-"} />
                  <Meta label="Model" value={selectedTrace.model || "-"} />
                  <Meta label="Created" value={formatTime(selectedTrace.createdAt)} />
                  <Meta label="Updated" value={formatTime(selectedTrace.updatedAt)} />
                  <Meta label="Finish" value={selectedTrace.finishReason || "-"} />
                </div>
              </div>
              {traceSubView === "raw" ? (
                <div className="panel">
                  <h3>Raw Trace</h3>
                  <JsonBlock value={selectedTrace} />
                </div>
              ) : (
                <>
                  <div className="panel">
                    <h3>Messages</h3>
                    {selectedTrace.messages?.length ? (
                      selectedTrace.messages.map((message, index) => (
                        <MessageBlock key={index} message={message} filters={filters} />
                      ))
                    ) : (
                      <div className="empty">No messages in summary. Select a trace or wait for detail loading.</div>
                    )}
                  </div>
                  <ResponsePanel trace={selectedTrace} hideSource={filters.hideSource} />
                  <EventsPanel trace={selectedTrace} hideSource={filters.hideSource} />
                </>
              )}
            </>
          ) : (
            <div className="empty">Select a trace.</div>
          )}
        </section>
      </div>
    </>
  );
}

function ResponsePanel({ trace, hideSource }: { trace: DebugTrace; hideSource: boolean }) {
  const parsed = parseResponse(trace.response);

  return (
    <div className="panel">
      <h3>Response</h3>
      {trace.error && <div className="inline-error trace-local-error">{trace.error}</div>}
      <div className="response-summary">
        <Meta label="Finish" value={trace.finishReason || parsed.finishReason || "-"} />
        <Meta label="Content length" value={String(parsed.content.length)} />
        <Meta label="Tool calls" value={String(parsed.toolCalls.length)} />
        <Meta label="Usage" value={formatUsage(trace.usage ?? parsed.usage)} />
      </div>
      {parsed.content ? (
        <div className="parsed-response-content">{parsed.content}</div>
      ) : (
        <div className="empty">No assistant content.</div>
      )}
      {parsed.toolCalls.length > 0 && (
        <div className="parsed-tool-calls">
          <h4>Tool calls</h4>
          {parsed.toolCalls.map((toolCall, index) => (
            <div className="tool-call-card" key={index}>
              <b>{toolCall.name || toolCall.type || `tool_${index + 1}`}</b>
              {toolCall.arguments && <pre>{toolCall.arguments}</pre>}
            </div>
          ))}
        </div>
      )}
      {!hideSource && (
        <div className="source-block">
          <h4>Response source</h4>
          <JsonBlock value={trace.response ?? { status: trace.status, error: trace.error }} />
        </div>
      )}
    </div>
  );
}

function EventsPanel({ trace, hideSource }: { trace: DebugTrace; hideSource: boolean }) {
  if (!trace.events?.length) return null;

  return (
    <div className="panel">
      <h3>Events</h3>
      <div className="event-list">
        {trace.events.map((event, index) => (
          <div className="event-row" key={index}>
            <b>{event.type}</b>
            <span>{formatTime(event.createdAt)}</span>
            {!hideSource && event.data !== undefined && <JsonBlock value={event.data} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function parseResponse(response: unknown): {
  content: string;
  toolCalls: Array<{ name?: string; type?: string; arguments?: string }>;
  finishReason?: string;
  usage?: unknown;
} {
  if (!isRecord(response)) return { content: "", toolCalls: [] };
  const choices = Array.isArray(response.choices) ? response.choices : [];
  const firstChoice = isRecord(choices[0]) ? choices[0] : null;
  const message = isRecord(firstChoice?.message) ? firstChoice.message : null;
  const content = typeof message?.content === "string" ? message.content : "";
  const rawToolCalls = Array.isArray(message?.tool_calls) ? message.tool_calls : [];
  const toolCalls = rawToolCalls.map((item) => {
    const toolCall = isRecord(item) ? item : {};
    const fn = isRecord(toolCall.function) ? toolCall.function : {};
    return {
      type: typeof toolCall.type === "string" ? toolCall.type : undefined,
      name: typeof fn.name === "string" ? fn.name : undefined,
      arguments: typeof fn.arguments === "string" ? fn.arguments : undefined,
    };
  });
  return {
    content,
    toolCalls,
    finishReason: typeof firstChoice?.finish_reason === "string" ? firstChoice.finish_reason : undefined,
    usage: response.usage,
  };
}

function formatUsage(usage: unknown): string {
  if (!isRecord(usage)) return "-";
  const prompt = usage.prompt_tokens ?? usage.promptTokens;
  const completion = usage.completion_tokens ?? usage.completionTokens;
  const total = usage.total_tokens ?? usage.totalTokens;
  if (total !== undefined) return `${total} total`;
  if (prompt !== undefined || completion !== undefined) return `${prompt ?? "-"} / ${completion ?? "-"}`;
  return "-";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
