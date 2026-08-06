/**
 * Debug React 主框架。
 */

import { useState } from "react";
import type { DebugView } from "./types";
import { ConfigPage } from "./views/config";
import { SessionsPage } from "./views/sessions";
import { StatusPage } from "./views/status";
import { TracePage } from "./views/trace";
import { viewLabel } from "./utils/view";

export function App() {
  const [view, setView] = useState<DebugView>("traces");

  return (
    <div className="shell">
      <nav className="top-nav">
        <div className="brand">Debug</div>
        {(["traces", "sessions", "status", "config"] as DebugView[]).map((item) => (
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
            {viewLabel(item)}
          </button>
        ))}
      </nav>
      <main className="workspace">
        {view === "traces" && <TracePage active />}
        {view === "sessions" && <SessionsPage active />}
        {view === "status" && <StatusPage active />}
        {view === "config" && <ConfigPage active />}
      </main>
    </div>
  );
}
