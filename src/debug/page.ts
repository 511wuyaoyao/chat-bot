/**
 * 调试面板页面
 * 用纯 HTML/CSS/JS 展示内存 trace，避免引入前端构建链。
 */

export function debugPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>QQ Bot Debug Traces</title>
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
    body { margin: 0; background: var(--panel); color: var(--text); font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 14px; border-bottom: 1px solid var(--border); background: var(--bg); }
    main { display: grid; grid-template-columns: 340px minmax(0, 1fr); height: calc(100vh - 48px); }
    aside { border-right: 1px solid var(--border); overflow: auto; }
    section { overflow: auto; padding: 14px; }
    button, input { font: inherit; }
    button { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 6px; padding: 5px 9px; cursor: pointer; }
    input { border: 1px solid var(--border); background: var(--panel); color: var(--text); border-radius: 6px; padding: 6px 8px; min-width: 220px; }
    .trace { padding: 10px 12px; border-bottom: 1px solid var(--border); cursor: pointer; }
    .trace:hover, .trace.active { background: var(--hover); }
    .row { display: flex; justify-content: space-between; gap: 8px; }
    .muted { color: var(--muted); }
    .failed { color: var(--danger); }
    .completed { color: var(--success); }
    .pending { color: var(--warning); }
    .tabs { display: flex; gap: 6px; margin-bottom: 12px; position: sticky; top: 0; background: var(--panel); padding-bottom: 8px; }
    .tabs button.active { background: var(--active); color: white; border-color: var(--active); }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
    .message { border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px; overflow: hidden; background: var(--panel); }
    .message h3 { margin: 0; padding: 8px 10px; background: var(--bg); font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
    .message-content { border-top: 1px solid var(--border); padding: 10px 12px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .message pre { border: 0; border-top: 1px solid var(--border); border-radius: 0; margin: 0; background: transparent; }
  </style>
</head>
<body>
  <header>
    <strong>Debug Traces</strong>
    <button id="refresh">刷新</button>
    <button id="clear">清空</button>
    <input id="search" placeholder="过滤 actor / userId / sessionId / error" />
    <span class="muted" id="count"></span>
  </header>
  <main>
    <aside id="list"></aside>
    <section>
      <div class="tabs">
        <button data-tab="overview" class="active">Overview</button>
        <button data-tab="messages">Messages</button>
        <button data-tab="events">Events</button>
        <button data-tab="response">Response</button>
        <button data-tab="raw">Raw JSON</button>
      </div>
      <div id="detail" class="muted">选择一条 trace</div>
    </section>
  </main>
  <script>
    let traces = [];
    let current = null;
    let tab = "overview";

    const $ = (id) => document.getElementById(id);
    const esc = (value) => String(value ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const json = (value) => esc(JSON.stringify(value, null, 2));
    const messageContent = (m) => {
      if (typeof m.content === "string") return esc(m.content);
      if (Array.isArray(m.content)) return json(m.content);
      return esc(m.content ?? "");
    };

    async function loadList() {
      const res = await fetch("/debug/traces");
      traces = await res.json();
      renderList();
    }

    function renderList() {
      const q = $("search").value.trim().toLowerCase();
      const filtered = traces.filter((t) => JSON.stringify(t).toLowerCase().includes(q));
      $("count").textContent = filtered.length + " / " + traces.length;
      $("list").innerHTML = filtered.map((t) => \`
        <div class="trace \${current && current.id === t.id ? "active" : ""}" data-id="\${esc(t.id)}">
          <div class="row"><strong>\${esc(t.actor)}</strong><span class="\${esc(t.status)}">\${esc(t.status)}</span></div>
          <div class="muted">\${esc(t.createdAt)} / round \${esc(t.round)} / \${esc(t.model)}</div>
          <div class="muted">\${esc(t.userId)} / \${esc(t.sessionId)}</div>
          \${t.error ? \`<div class="failed">\${esc(t.error)}</div>\` : ""}
        </div>
      \`).join("");
    }

    async function selectTrace(id) {
      const res = await fetch("/debug/traces/" + encodeURIComponent(id));
      current = await res.json();
      renderList();
      renderDetail();
    }

    function renderDetail() {
      if (!current) return;
      document.querySelectorAll(".tabs button").forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tab));
      if (tab === "overview") {
        $("detail").innerHTML = \`
          <pre>\${json({
            id: current.id,
            actor: current.actor,
            userId: current.userId,
            sessionId: current.sessionId,
            mainSessionId: current.mainSessionId,
            round: current.round,
            model: current.model,
            status: current.status,
            finishReason: current.finishReason,
            usage: current.usage,
            params: current.params,
            error: current.error,
          })}</pre>\`;
      } else if (tab === "messages") {
        $("detail").innerHTML = (current.messages || []).map((m, i) => \`
          <div class="message">
            <h3><span>#\${i} \${esc(m.role)}</span><button data-copy="\${i}">复制</button></h3>
            \${typeof m.content === "string" ? \`<div class="message-content">\${messageContent(m)}</div>\` : ""}
            <pre>\${json(m)}</pre>
          </div>
        \`).join("");
      } else if (tab === "events") {
        $("detail").innerHTML = \`<pre>\${json(current.events || [])}</pre>\`;
      } else if (tab === "response") {
        $("detail").innerHTML = \`<pre>\${json(current.response || current.error || null)}</pre>\`;
      } else {
        $("detail").innerHTML = \`<pre>\${json(current)}</pre>\`;
      }
    }

    $("list").addEventListener("click", (event) => {
      const item = event.target.closest(".trace");
      if (item) selectTrace(item.dataset.id);
    });
    document.querySelector(".tabs").addEventListener("click", (event) => {
      const btn = event.target.closest("button[data-tab]");
      if (!btn) return;
      tab = btn.dataset.tab;
      renderDetail();
    });
    $("detail").addEventListener("click", async (event) => {
      const btn = event.target.closest("button[data-copy]");
      if (!btn || !current) return;
      await navigator.clipboard.writeText(JSON.stringify(current.messages[Number(btn.dataset.copy)], null, 2));
    });
    $("refresh").onclick = loadList;
    $("search").oninput = renderList;
    $("clear").onclick = async () => { await fetch("/debug/traces", { method: "DELETE" }); current = null; await loadList(); $("detail").textContent = "选择一条 trace"; };
    loadList();
    setInterval(loadList, 3000);
  </script>
</body>
</html>`;
}
