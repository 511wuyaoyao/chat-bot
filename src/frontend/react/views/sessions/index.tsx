/**
 * Debug Sessions 页面。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { debugApi } from "../../api";
import type { DebugSessionDetail, DebugSessionList, VisibilityFilters } from "../../types";
import { MessageBlock } from "../../components/common";
import { groupSessionsByPerson, sessionActiveMessageCount, sessionMessageCount } from "../../utils/sessions";
import { formatTime, shortSessionId } from "../../utils/view";

export function SessionsPage({ active }: { active: boolean }) {
  const [sessions, setSessions] = useState<DebugSessionList>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedActor, setSelectedActor] = useState("main");
  const [detail, setDetail] = useState<DebugSessionDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useState<VisibilityFilters>({
    hideSource: true,
    hideTools: true,
    hideDeleted: false,
    hideTopic: false,
  });

  const sessionsByPerson = useMemo(() => groupSessionsByPerson(sessions), [sessions]);
  const personIds = useMemo(() => Object.keys(sessionsByPerson).sort(), [sessionsByPerson]);
  const currentPersonId = selectedPersonId || personIds[0] || null;
  const currentSessions = currentPersonId ? sessionsByPerson[currentPersonId] || [] : [];
  const selectedSession = currentSessions.find((session) => session.sessionId === selectedSessionId) || null;

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      setSessions(await debugApi.sessions());
    } catch (error) {
      setLoadError(String(error));
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadData();
    const timer = window.setInterval(() => void loadData(), 3000);
    return () => window.clearInterval(timer);
  }, [active, loadData]);

  useEffect(() => {
    if (!active || !selectedSession || !selectedActor) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    debugApi
      .sessionDetail(selectedSession.personId, selectedSession.sessionId, selectedActor)
      .then((nextDetail) => {
        if (!cancelled) setDetail(nextDetail);
      })
      .catch((error) => {
        if (!cancelled) {
          setDetail(null);
          setLoadError(String(error));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [active, selectedActor, selectedSession]);

  const toggleFilter = (key: keyof VisibilityFilters) => {
    setFilters((current) => ({ ...current, [key]: !current[key] }));
  };

  return (
    <>
      <div className="toolbar">
        <button onClick={() => void loadData()}>Refresh</button>
        <button className={filters.hideSource ? "filter-active" : ""} onClick={() => toggleFilter("hideSource")}>Source</button>
        <button className={filters.hideTools ? "filter-active" : ""} onClick={() => toggleFilter("hideTools")}>Tools</button>
        <button className={filters.hideDeleted ? "filter-active" : ""} onClick={() => toggleFilter("hideDeleted")}>Hide compressed</button>
        <button className={filters.hideTopic ? "filter-active" : ""} onClick={() => toggleFilter("hideTopic")}>Topic</button>
        <div className="spacer" />
      </div>
      {loadError && <div className="inline-error">{loadError}</div>}
      <div className="content three-column">
        <aside>
          {personIds.map((personId) => (
            <button key={personId} className={currentPersonId === personId ? "item active" : "item"} onClick={() => {
              setSelectedPersonId(personId);
              setSelectedSessionId(null);
              setDetail(null);
            }}>
              <b>{personId}</b>
              <span>{sessionsByPerson[personId]?.length || 0} sessions</span>
            </button>
          ))}
        </aside>
        <aside>
          {currentSessions.map((session) => (
            <button key={session.sessionId} className={selectedSession?.sessionId === session.sessionId ? "item active" : "item"} onClick={() => {
              setSelectedSessionId(session.sessionId);
              setSelectedActor(session.actors?.[0]?.actor || "main");
              setDetail(null);
            }}>
              <b className="session-title">
                <span>{shortSessionId(session.sessionId)}</span>
                {session.isCurrent && <span className="current-pill">Current</span>}
              </b>
              <span>{sessionActiveMessageCount(session)}/{sessionMessageCount(session)}</span>
              <small>{formatTime(session.updatedAt)}</small>
            </button>
          ))}
        </aside>
        <section>
          {selectedSession ? (
            <>
              <div className="panel">
                <h2>{shortSessionId(selectedSession.sessionId)}</h2>
                <div className="muted">Person ID: {selectedSession.personId}</div>
                <div className="muted">Updated: {formatTime(selectedSession.updatedAt)}</div>
                <div className="actor-buttons">
                  {(selectedSession.actors || []).map((actor) => (
                    <button key={actor.actor} className={selectedActor === actor.actor ? "active" : ""} onClick={() => {
                      setSelectedActor(actor.actor);
                      setDetail(null);
                    }}>
                      {actor.actor} · {actor.activeMessageCount ?? actor.messageCount ?? 0}/{actor.messageCount ?? 0}
                    </button>
                  ))}
                </div>
              </div>
              {detail ? (
                detail.messages.map((message, index) => <MessageBlock key={index} message={message} filters={filters} />)
              ) : (
                <div className="empty">Loading session detail...</div>
              )}
            </>
          ) : (
            <div className="empty">Select a session.</div>
          )}
        </section>
      </div>
    </>
  );
}
