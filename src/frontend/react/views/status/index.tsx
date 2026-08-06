/**
 * Debug Status 页面。
 */

import { useCallback, useEffect, useState } from "react";
import { debugApi } from "../../api";
import type { DebugStatus } from "../../types";
import { JsonBlock, Meta } from "../../components/common";
import { formatBytes } from "../../utils/view";

export function StatusPage({ active }: { active: boolean }) {
  const [status, setStatus] = useState<DebugStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoadError(null);
      setStatus(await debugApi.status());
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

  return (
    <>
      <div className="toolbar">
        <button onClick={() => void loadData()}>Refresh</button>
        <div className="spacer" />
      </div>
      {loadError && <div className="inline-error">{loadError}</div>}
      {!status ? (
        <div className="content single"><section className="empty">No status.</section></div>
      ) : (
        <div className="content single">
          <section>
            <div className="panel">
              <h2>Status</h2>
              <div className="status-grid">
                <Meta label="Adapter" value={status.adapter || "-"} />
                <Meta label="Uptime" value={`${Math.round((status.uptimeSeconds || 0) / 60)} min`} />
                <Meta label="Memory" value={formatBytes(status.memoryRss)} />
                <Meta label="Trace" value={String(status.traceCount || 0)} />
              </div>
            </div>
            <JsonBlock value={status} />
          </section>
        </div>
      )}
    </>
  );
}
