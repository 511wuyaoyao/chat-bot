/**
 * 调试面板页面
 * 用纯 HTML/CSS/JS 展示 trace 和 session 上下文，避免引入前端构建链。
 */

export function debugPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QQ Bot Debug</title>
  <style>
    :root {
      color-scheme: light;
      --text: #24292f;
      --panel: #ffffff;
      --bg: #f6f8fa;
      --border: #d0d7de;
      --muted: #667085;
      --hover: #eef6ff;
      --active: #0969da;
      --danger: #b42318;
      --success: #067647;
      --warning: #b54708;
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; overflow: hidden; }
    body { margin: 0; background: var(--panel); color: var(--text); font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .shell { display: grid; grid-template-columns: 132px minmax(0, 1fr); height: 100vh; min-height: 0; overflow: hidden; }
    .top-nav { border-right: 1px solid var(--border); background: var(--bg); padding: 14px 10px; overflow: auto; }
    .brand { font-weight: 700; margin: 0 0 14px 4px; }
    .nav-button { width: 100%; text-align: left; margin-bottom: 6px; }
    .workspace { min-width: 0; min-height: 0; display: grid; grid-template-rows: 48px minmax(0, 1fr); overflow: hidden; }
    .toolbar { display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid var(--border); background: var(--panel); min-width: 0; }
    .content { min-height: 0; overflow: hidden; }
    .content.trace-layout { display: grid; grid-template-columns: 380px minmax(0, 1fr); }
    .content.session-layout { display: grid; grid-template-columns: 220px 340px minmax(0, 1fr); }
    .content.status-layout { display: grid; grid-template-columns: minmax(0, 1fr); }
    .content.status-layout #primary-list { display: none; }
    aside, section { overflow: auto; min-width: 0; min-height: 0; height: 100%; }
    aside { border-right: 1px solid var(--border); }
    section { padding: 14px; }
    button, input { font: inherit; }
    button { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 6px; padding: 5px 9px; cursor: pointer; }
    button.active { background: var(--active); color: white; border-color: var(--active); }
    button.filter-active { background: #fff7ed; color: var(--warning); border-color: #fed7aa; font-weight: 700; }
    input { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 6px; padding: 6px 8px; min-width: 300px; }
    .toolbar .divider { width: 1px; height: 22px; background: var(--border); }
    .toolbar .spacer { flex: 1 1 auto; min-width: 0; }
    .side-title { position: sticky; top: 0; z-index: 1; padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--bg); color: var(--muted); font-weight: 700; }
    .list-item { padding: 10px 12px; border-bottom: 1px solid var(--border); cursor: pointer; }
    .list-item:hover, .list-item.active { background: var(--hover); }
    .list-item.current { border-left: 4px solid var(--success); padding-left: 8px; }
    .row { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .muted { color: var(--muted); }
    .failed { color: var(--danger); }
    .completed { color: var(--success); }
    .pending { color: var(--warning); }
    .current-label { color: var(--success); font-weight: 700; }
    .tabs { display: flex; gap: 6px; margin-bottom: 12px; position: sticky; top: 0; background: var(--panel); padding-bottom: 8px; z-index: 1; }
    .tabs button.active { background: var(--active); color: white; border-color: var(--active); }
    .filter-status { display: none; margin: 0 0 12px; padding: 8px 10px; border: 1px solid #fed7aa; background: #fff7ed; color: var(--warning); border-radius: 6px; font-weight: 700; }
    .filter-status.visible { display: block; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
    .message { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; overflow: hidden; background: var(--panel); }
    .message.deleted { opacity: 0.62; border-style: dashed; }
    .message.response { border-color: #84b8ff; }
    .message h3 { margin: 0; padding: 8px 10px; background: var(--bg); font-size: 13px; display: flex; justify-content: space-between; align-items: center; gap: 10px; }
    .message.deleted h3 { background: #fff7ed; color: var(--warning); }
    .message.response h3 { background: #eef6ff; }
    .badge { color: var(--muted); font-weight: 500; margin-left: 8px; }
    .message-content { border-top: 1px solid var(--border); padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .message pre { border: 0; border-top: 1px solid var(--border); border-radius: 0; margin: 0; background: transparent; }
    .message.tool-message h3, .message.tool-call-message h3 { background: #f0fdf4; }
    .message.topic-message { border-color: #8b5cf6; border-left: 6px solid #7c3aed; }
    .message.topic-message h3 { background: #ede9fe; color: #4c1d95; }
    .topic-badge { display: inline-block; margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: #7c3aed; color: white; font-weight: 800; }
    .message-actions { display: flex; gap: 6px; align-items: center; flex: 0 0 auto; }
    .message-actions button { padding: 3px 7px; }
    #detail.hide-source .message pre { display: none; }
    #detail.hide-tools .message.tool-message, #detail.hide-tools .message.tool-call-message { display: none; }
    #detail.hide-deleted .message.deleted { display: none; }
    #detail.hide-topic .message.topic-message { border-color: var(--border); border-left: 1px solid var(--border); }
    #detail.hide-topic .message.topic-message h3 { background: var(--bg); color: var(--text); }
    #detail.hide-topic .topic-badge { display: none; }
    .actor-buttons { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .actor-buttons button { padding: 5px 8px; text-align: left; }
    .actor-main { display: block; line-height: 1.2; }
    .actor-sub { display: block; margin-top: 3px; color: var(--muted); font-size: 11px; line-height: 1.2; }
    .status-grid { display: grid; grid-template-columns: repeat(4, minmax(140px, 1fr)); gap: 12px; margin-bottom: 12px; }
    .status-card { border: 1px solid var(--border); border-radius: 8px; background: var(--panel); padding: 12px; }
    .status-card .label { color: var(--muted); margin-bottom: 6px; }
    .status-card .value { font-size: 20px; font-weight: 800; }
  </style>
</head>
<body>
  <div class="shell">
    <nav class="top-nav">
      <div class="brand">Debug</div>
      <button id="view-traces" class="nav-button active">Traces</button>
      <button id="view-sessions" class="nav-button">Sessions</button>
      <button id="view-status" class="nav-button">Status</button>
    </nav>
    <div class="workspace">
      <div class="toolbar">
        <button id="refresh">刷新</button>
        <button id="clear">清空 Trace</button>
        <button id="toggle-source">折叠源码</button>
        <button id="toggle-tools">折叠 Tools</button>
        <button id="toggle-deleted">折叠 Deleted</button>
        <button id="toggle-topic">隐藏 Topic 标记</button>
        <div class="divider"></div>
        <input id="search" placeholder="过滤 trace" />
        <div class="spacer"></div>
        <span class="muted" id="count"></span>
      </div>
      <div id="content" class="content trace-layout">
        <aside id="primary-list"></aside>
        <section>
          <div class="tabs" id="tabs"></div>
          <div class="filter-status" id="filter-status"></div>
          <div id="detail" class="muted">选择一条 trace</div>
        </section>
      </div>
    </div>
  </div>
  <script>
    let view = "traces";
    let traces = [];
    let sessions = [];
    let status = null;
    let selectedUserId = "";
    let currentTrace = null;
    let currentSession = null;
    let currentSessionKey = "";
    let tab = "overview";
    let sourceCollapsed = false;
    let toolsCollapsed = false;
    let deletedCollapsed = false;
    let topicCollapsed = false;

    const $ = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const json = (value) => esc(JSON.stringify(value, null, 2));
    const formatTime = (value) => value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
    const formatBytes = (value) => {
      const bytes = Number(value || 0);
      if (bytes < 1024) return bytes + " B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / 1024 / 1024).toFixed(1) + " MB";
    };
    const pct = (used, max) => max > 0 ? ((used / max) * 100).toFixed(1) + "%" : "-";
    const messageContent = (m) => {
      if (typeof m.content === "string") return esc(m.content);
      if (Array.isArray(m.content)) return json(m.content);
      return esc(m.content ?? "");
    };
    const responseMessage = (trace) => trace && trace.response && trace.response.choices && trace.response.choices[0]
      ? trace.response.choices[0].message
      : null;

    function renderMessage(m, i, extraClass = "", badge = "", copyAttr = \`data-copy="\${i}"\`) {
      const toolClass = m.role === "tool" ? "tool-message" : (m.tool_calls ? "tool-call-message" : "");
      const topicClass = m.topic ? "topic-message" : "";
      return \`
        <div class="message \${extraClass} \${toolClass} \${topicClass} \${m.deleted ? "deleted" : ""}">
          <h3>
            <span>#\${i} \${esc(m.role)}\${badge}\${m.topic ? \`<span class="topic-badge">TOPIC: \${esc(m.topic)}</span>\` : ""}\${m.tool_calls ? '<span class="badge">tool_calls</span>' : ""}\${m.deleted ? \`<span class="badge">DELETED L\${esc(m.compactionLayer)} / \${esc(m.deletedReason)}</span>\` : ""}</span>
            <span class="message-actions"><button \${copyAttr}>复制</button></span>
          </h3>
          \${typeof m.content === "string" ? \`<div class="message-content">\${messageContent(m)}</div>\` : ""}
          <pre>\${json(m)}</pre>
        </div>
      \`;
    }

    function setTabs(items) {
      $("tabs").innerHTML = items.map((item) => \`<button data-tab="\${esc(item.id)}" class="\${tab === item.id ? "active" : ""}">\${esc(item.label)}</button>\`).join("");
    }

    function sessionsByUser() {
      const map = new Map();
      for (const session of sessions) {
        if (!map.has(session.userId)) map.set(session.userId, []);
        map.get(session.userId).push(session);
      }
      return Array.from(map.entries()).map(([userId, items]) => ({
        userId,
        sessions: items.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
      })).sort((a, b) => {
        const au = Math.max(...a.sessions.map((s) => s.updatedAt ?? 0));
        const bu = Math.max(...b.sessions.map((s) => s.updatedAt ?? 0));
        return bu - au;
      });
    }

    async function loadData() {
      if (view === "traces") {
        const res = await fetch("/debug/traces");
        traces = await res.json();
      } else if (view === "sessions") {
        const res = await fetch("/debug/sessions");
        sessions = await res.json();
        const users = sessionsByUser();
        if (!selectedUserId && users[0]) selectedUserId = users[0].userId;
      } else {
        const res = await fetch("/debug/cache");
        status = await res.json();
      }
      renderLayout();
      renderDetail();
    }

    function renderLayout() {
      $("view-traces").classList.toggle("active", view === "traces");
      $("view-sessions").classList.toggle("active", view === "sessions");
      $("view-status").classList.toggle("active", view === "status");
      $("clear").style.display = view === "traces" ? "" : "none";
      $("search").style.display = view === "status" ? "none" : "";
      updateFilterControls();
      $("search").placeholder = view === "traces" ? "过滤 actor / userId / sessionId / error" : "过滤 userId / sessionId / actor";
      $("content").className = view === "traces" ? "content trace-layout" : (view === "sessions" ? "content session-layout" : "content status-layout");
      if (view === "traces") renderTraceList();
      else if (view === "sessions") renderSessionColumns();
      else renderStatusLayout();
    }

    function renderTraceList() {
      const q = $("search").value.trim().toLowerCase();
      const filtered = traces.filter((t) => JSON.stringify(t).toLowerCase().includes(q));
      $("count").textContent = filtered.length + " / " + traces.length;
      $("primary-list").innerHTML = '<div class="side-title">Traces</div>' + filtered.map((t) => \`
        <div class="list-item \${currentTrace && currentTrace.id === t.id ? "active" : ""}" data-trace-id="\${esc(t.id)}">
          <div class="row"><strong>\${esc(t.actor)}</strong><span class="\${esc(t.status)}">\${esc(t.status)}</span></div>
          <div class="muted">\${esc(t.createdAt)} / round \${esc(t.round)} / \${esc(t.model)}</div>
          <div class="muted">\${esc(t.userId)} / \${esc(t.sessionId)}</div>
          \${t.error ? \`<div class="failed">\${esc(t.error)}</div>\` : ""}
        </div>
      \`).join("");
    }

    function renderSessionColumns() {
      const q = $("search").value.trim().toLowerCase();
      const filtered = q ? sessions.filter((s) => JSON.stringify(s).toLowerCase().includes(q)) : sessions;
      const groups = sessionsByUserFrom(filtered);
      if (!selectedUserId || !groups.some((g) => g.userId === selectedUserId)) selectedUserId = groups[0] ? groups[0].userId : "";
      const selectedGroup = groups.find((g) => g.userId === selectedUserId);
      $("count").textContent = filtered.length + " / " + sessions.length;
      $("primary-list").innerHTML = '<div class="side-title">账号</div>' + groups.map((g) => {
        const currentCount = g.sessions.filter((s) => s.isCurrent).length;
        return \`
          <div class="list-item \${selectedUserId === g.userId ? "active" : ""}" data-user-id="\${esc(g.userId)}">
            <div class="row"><strong>\${esc(g.userId)}</strong><span class="muted">\${g.sessions.length}</span></div>
            <div class="muted">\${currentCount ? '<span class="current-label">current</span>' : "no current"}</div>
          </div>
        \`;
      }).join("");
      const sessionHtml = selectedGroup ? selectedGroup.sessions.map((s) => \`
        <div class="list-item \${currentSessionKey === s.userId + "/" + s.sessionId ? "active" : ""} \${s.isCurrent ? "current" : ""}">
          <div class="row"><strong>\${esc(shortSessionId(s.sessionId))}</strong>\${s.isCurrent ? '<span class="current-label">当前</span>' : ""}</div>
          <div class="muted">\${esc(s.sessionId)}</div>
          <div class="muted">\${esc(formatTime(s.updatedAt))}</div>
          <div class="actor-buttons">
            \${(s.actors || []).map((a) => \`<button data-session-user="\${esc(s.userId)}" data-session-id="\${esc(s.sessionId)}" data-session-actor="\${esc(a.actor)}"><span class="actor-main">\${esc(a.actor)} \${esc(a.messageCount ?? 0)}\${a.deletedCount ? " / del " + esc(a.deletedCount) : ""}</span><span class="actor-sub">\${esc(formatBytes(a.contextSize))}</span></button>\`).join("")}
          </div>
        </div>
      \`).join("") : "";
      ensureSessionAside();
      $("session-list").innerHTML = '<div class="side-title">Sessions</div>' + (sessionHtml || '<div class="list-item muted">没有 session</div>');
    }

    function renderStatusLayout() {
      removeSessionAside();
      $("count").textContent = "";
      $("primary-list").innerHTML = "";
    }

    function sessionsByUserFrom(items) {
      const map = new Map();
      for (const session of items) {
        if (!map.has(session.userId)) map.set(session.userId, []);
        map.get(session.userId).push(session);
      }
      return Array.from(map.entries()).map(([userId, sessions]) => ({
        userId,
        sessions: sessions.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
      })).sort((a, b) => {
        const ac = a.sessions.some((s) => s.isCurrent) ? 1 : 0;
        const bc = b.sessions.some((s) => s.isCurrent) ? 1 : 0;
        const au = Math.max(...a.sessions.map((s) => s.updatedAt ?? 0));
        const bu = Math.max(...b.sessions.map((s) => s.updatedAt ?? 0));
        return bc - ac || bu - au;
      });
    }

    function ensureSessionAside() {
      if ($("session-list")) return;
      const aside = document.createElement("aside");
      aside.id = "session-list";
      $("content").insertBefore(aside, $("content").querySelector("section"));
    }

    function removeSessionAside() {
      const aside = $("session-list");
      if (aside) aside.remove();
    }

    function shortSessionId(sessionId) {
      const idx = sessionId.indexOf("_");
      return idx >= 0 ? sessionId.slice(idx + 1) : sessionId;
    }

    async function selectTrace(id) {
      const res = await fetch("/debug/traces/" + encodeURIComponent(id));
      currentTrace = await res.json();
      currentSession = null;
      tab = "overview";
      renderLayout();
      renderDetail();
    }

    async function selectSession(userId, sessionId, actor) {
      const res = await fetch("/debug/sessions/" + encodeURIComponent(userId) + "/" + encodeURIComponent(sessionId) + "/" + encodeURIComponent(actor));
      currentSession = await res.json();
      currentSessionKey = userId + "/" + sessionId;
      currentTrace = null;
      tab = "messages";
      renderLayout();
      renderDetail();
    }

    function renderDetail() {
      if (view === "traces") renderTraceDetail();
      else if (view === "sessions") renderSessionDetail();
      else renderStatusDetail();
      applyDetailFilters();
    }

    function applyDetailFilters() {
      $("detail").classList.toggle("hide-source", sourceCollapsed);
      $("detail").classList.toggle("hide-tools", toolsCollapsed);
      $("detail").classList.toggle("hide-deleted", deletedCollapsed);
      $("detail").classList.toggle("hide-topic", topicCollapsed);
      updateFilterControls();
    }

    function updateFilterControls() {
      const active = [];
      if (sourceCollapsed) active.push("源码 JSON");
      if (toolsCollapsed) active.push("Tools");
      if (deletedCollapsed) active.push("Deleted");
      if (topicCollapsed) active.push("Topic 标记");
      $("toggle-source").textContent = sourceCollapsed ? "已折叠源码" : "折叠源码";
      $("toggle-tools").textContent = toolsCollapsed ? "已折叠 Tools" : "折叠 Tools";
      $("toggle-deleted").textContent = deletedCollapsed ? "已折叠 Deleted" : "折叠 Deleted";
      $("toggle-topic").textContent = topicCollapsed ? "已隐藏 Topic 标记" : "隐藏 Topic 标记";
      $("toggle-source").classList.toggle("filter-active", sourceCollapsed);
      $("toggle-tools").classList.toggle("filter-active", toolsCollapsed);
      $("toggle-deleted").classList.toggle("filter-active", deletedCollapsed);
      $("toggle-topic").classList.toggle("filter-active", topicCollapsed);
      $("filter-status").classList.toggle("visible", active.length > 0);
      $("filter-status").textContent = active.length > 0 ? "当前已隐藏：" + active.join(" / ") : "";
    }

    function renderStatusDetail() {
      setTabs([{ id: "overview", label: "Overview" }, { id: "raw", label: "Raw JSON" }]);
      const detail = status && status.detail ? status.detail : { maxBytes: 0, totalBytes: 0, itemCount: 0 };
      const trace = status && status.trace ? status.trace : { maxBytes: 0, totalBytes: 0, itemCount: 0, maxKeep: 0 };
      if (tab === "raw") {
        $("detail").innerHTML = \`<pre>\${json(status)}</pre>\`;
        return;
      }
      const freeBytes = Math.max(0, Number(detail.maxBytes || 0) - Number(detail.totalBytes || 0));
      const traceFreeBytes = Math.max(0, Number(trace.maxBytes || 0) - Number(trace.totalBytes || 0));
      $("detail").innerHTML = \`
        <div class="status-grid">
          <div class="status-card"><div class="label">Detail Cache Used</div><div class="value">\${esc(formatBytes(detail.totalBytes))}</div></div>
          <div class="status-card"><div class="label">Detail Cache Limit</div><div class="value">\${esc(formatBytes(detail.maxBytes))}</div></div>
          <div class="status-card"><div class="label">Usage</div><div class="value">\${esc(pct(detail.totalBytes, detail.maxBytes))}</div></div>
          <div class="status-card"><div class="label">Cached Items</div><div class="value">\${esc(detail.itemCount)}</div></div>
          <div class="status-card"><div class="label">Trace Store Used</div><div class="value">\${esc(formatBytes(trace.totalBytes))}</div></div>
          <div class="status-card"><div class="label">Trace Store Limit</div><div class="value">\${esc(formatBytes(trace.maxBytes))}</div></div>
          <div class="status-card"><div class="label">Trace Usage</div><div class="value">\${esc(pct(trace.totalBytes, trace.maxBytes))}</div></div>
          <div class="status-card"><div class="label">Trace Items</div><div class="value">\${esc(trace.itemCount)} / \${esc(trace.maxKeep)}</div></div>
        </div>
        <pre>\${json({
          detailCache: {
            usedBytes: detail.totalBytes,
            used: formatBytes(detail.totalBytes),
            maxBytes: detail.maxBytes,
            max: formatBytes(detail.maxBytes),
            freeBytes,
            free: formatBytes(freeBytes),
            usage: pct(detail.totalBytes, detail.maxBytes),
            itemCount: detail.itemCount,
          },
          traceStore: {
            usedBytes: trace.totalBytes,
            used: formatBytes(trace.totalBytes),
            maxBytes: trace.maxBytes,
            max: formatBytes(trace.maxBytes),
            freeBytes: traceFreeBytes,
            free: formatBytes(traceFreeBytes),
            usage: pct(trace.totalBytes, trace.maxBytes),
            itemCount: trace.itemCount,
            maxKeep: trace.maxKeep,
          },
        })}</pre>
      \`;
    }

    function renderTraceDetail() {
      removeSessionAside();
      setTabs([
        { id: "overview", label: "Overview" },
        { id: "messages", label: "Messages" },
        { id: "events", label: "Events" },
        { id: "response", label: "Response" },
        { id: "raw", label: "Raw JSON" },
      ]);
      if (!currentTrace) {
        $("detail").textContent = "选择一条 trace";
        return;
      }
      if (tab === "overview") {
        $("detail").innerHTML = \`
          <pre>\${json({
            id: currentTrace.id,
            actor: currentTrace.actor,
            userId: currentTrace.userId,
            sessionId: currentTrace.sessionId,
            mainSessionId: currentTrace.mainSessionId,
            round: currentTrace.round,
            model: currentTrace.model,
            status: currentTrace.status,
            finishReason: currentTrace.finishReason,
            usage: currentTrace.usage,
            params: currentTrace.params,
            error: currentTrace.error,
          })}</pre>\`;
      } else if (tab === "messages") {
        const messages = currentTrace.messages || [];
        const inputHtml = messages.map((m, i) => renderMessage(m, i)).join("");
        const output = responseMessage(currentTrace);
        const outputHtml = output
          ? renderMessage(output, messages.length, "response", '<span class="badge">response</span>', 'data-copy-output="1"')
          : "";
        $("detail").innerHTML = inputHtml + outputHtml;
      } else if (tab === "events") {
        $("detail").innerHTML = \`<pre>\${json(currentTrace.events || [])}</pre>\`;
      } else if (tab === "response") {
        $("detail").innerHTML = \`<pre>\${json(currentTrace.response || currentTrace.error || null)}</pre>\`;
      } else {
        $("detail").innerHTML = \`<pre>\${json(currentTrace)}</pre>\`;
      }
    }

    function renderSessionDetail() {
      setTabs([
        { id: "messages", label: "Messages" },
        { id: "overview", label: "Overview" },
        { id: "raw", label: "Raw JSON" },
      ]);
      if (!currentSession) {
        $("detail").textContent = "选择一个 session actor";
        return;
      }
      if (tab === "overview") {
        $("detail").innerHTML = \`
          <pre>\${json({
            userId: currentSession.userId,
            sessionId: currentSession.sessionId,
            actor: currentSession.actor,
            messageCount: currentSession.messageCount,
            deletedCount: currentSession.deletedCount,
            updatedAt: formatTime(currentSession.updatedAt),
            contextPath: currentSession.contextPath,
          })}</pre>\`;
      } else if (tab === "messages") {
        $("detail").innerHTML = (currentSession.messages || []).map((m, i) => renderMessage(m, i)).join("");
      } else {
        $("detail").innerHTML = \`<pre>\${json(currentSession)}</pre>\`;
      }
    }

    $("view-traces").onclick = () => { view = "traces"; tab = "overview"; removeSessionAside(); renderLayout(); renderDetail(); loadData(); };
    $("view-sessions").onclick = () => { view = "sessions"; tab = "messages"; renderLayout(); renderDetail(); loadData(); };
    $("view-status").onclick = () => { view = "status"; tab = "overview"; removeSessionAside(); renderLayout(); renderDetail(); loadData(); };
    $("refresh").onclick = loadData;
    $("search").oninput = renderLayout;
    $("toggle-source").onclick = () => { sourceCollapsed = !sourceCollapsed; applyDetailFilters(); };
    $("toggle-tools").onclick = () => { toolsCollapsed = !toolsCollapsed; applyDetailFilters(); };
    $("toggle-deleted").onclick = () => { deletedCollapsed = !deletedCollapsed; applyDetailFilters(); };
    $("toggle-topic").onclick = () => { topicCollapsed = !topicCollapsed; applyDetailFilters(); };
    $("clear").onclick = async () => { await fetch("/debug/traces", { method: "DELETE" }); currentTrace = null; await loadData(); $("detail").textContent = "选择一条 trace"; };
    $("primary-list").addEventListener("click", (event) => {
      const traceItem = event.target.closest("[data-trace-id]");
      if (traceItem) selectTrace(traceItem.dataset.traceId);
      const userItem = event.target.closest("[data-user-id]");
      if (userItem) {
        selectedUserId = userItem.dataset.userId;
        currentSession = null;
        currentSessionKey = "";
        renderLayout();
        renderDetail();
      }
    });
    $("content").addEventListener("click", (event) => {
      const sessionBtn = event.target.closest("button[data-session-user]");
      if (sessionBtn) selectSession(sessionBtn.dataset.sessionUser, sessionBtn.dataset.sessionId, sessionBtn.dataset.sessionActor);
    });
    $("tabs").addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-tab]");
      if (!btn) return;
      tab = btn.dataset.tab;
      renderDetail();
    });
    $("detail").addEventListener("click", async (event) => {
      const btn = event.target.closest("button[data-copy]");
      const outputBtn = event.target.closest("button[data-copy-output]");
      if (outputBtn && currentTrace) {
        await navigator.clipboard.writeText(JSON.stringify(responseMessage(currentTrace), null, 2));
        return;
      }
      if (btn && view === "traces" && currentTrace) {
        await navigator.clipboard.writeText(JSON.stringify(currentTrace.messages[Number(btn.dataset.copy)], null, 2));
      }
      if (btn && view === "sessions" && currentSession) {
        await navigator.clipboard.writeText(JSON.stringify(currentSession.messages[Number(btn.dataset.copy)], null, 2));
      }
    });

    loadData();
    setInterval(loadData, 3000);
  </script>
</body>
</html>`;
}
