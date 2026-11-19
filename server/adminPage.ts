export const ADMIN_PAGE_HEADERS: Record<string, string> = {
  'X-Robots-Tag': 'noindex, nofollow',
  'Cache-Control': 'no-store',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'",
};

export function renderAdminPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Fit or Pivot — Admin Telemetry</title>
  <style>
    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --surface-2: #273449;
      --border: #334155;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --green: #34d399;
      --amber: #fbbf24;
      --red: #f87171;
      --purple: #a78bfa;
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      font-size: 14px;
      line-height: 1.45;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 20px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    nav.tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      padding: 10px 20px 0;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    nav.tabs button {
      background: transparent;
      border: 1px solid transparent;
      border-bottom: none;
      color: var(--muted);
      padding: 8px 14px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      border-radius: 6px 6px 0 0;
    }
    nav.tabs button:hover { color: var(--text); }
    nav.tabs button.active {
      background: var(--bg);
      color: var(--accent);
      border-color: var(--border);
    }
    main {
      padding: 20px;
      max-width: 1440px;
      margin: 0 auto;
    }
    .panel { display: none; }
    .panel.active { display: block; }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
      padding: 12px;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
    }
    label.field {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: var(--muted);
      font-size: 12px;
    }
    input, select, button {
      font: inherit;
      color: var(--text);
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 6px 10px;
    }
    input::placeholder { color: #64748b; }
    button.btn {
      background: var(--surface-2);
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    button.btn:hover { border-color: var(--accent); }
    button.btn-primary {
      background: #0284c7;
      border-color: #0284c7;
    }
    button.btn-primary:hover { background: #0369a1; }
    button.btn-danger {
      background: #991b1b;
      border-color: #b91c1c;
    }
    button.btn-danger:hover { background: #7f1d1d; }
    button.btn-sm {
      padding: 3px 8px;
      font-size: 12px;
      white-space: nowrap;
    }
    a.btn-link {
      display: inline-block;
      text-decoration: none;
      color: var(--text);
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 12px;
      font-weight: 500;
    }
    a.btn-link:hover { border-color: var(--accent); }
    .grid-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 16px;
      min-width: 0;
    }
    .card h2, .card h3 {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
    }
    .kpi-label {
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .kpi-value {
      font-size: 24px;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .kpi-sub {
      font-size: 12px;
      color: var(--muted);
      margin-top: 2px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    th, td {
      text-align: left;
      padding: 7px 8px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    th {
      color: var(--muted);
      font-weight: 600;
      font-size: 11.5px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }
    tr.clickable { cursor: pointer; }
    tr.clickable:hover { background: var(--surface-2); }
    tr.selected { background: rgba(56, 189, 248, 0.14); }
    .mono { font-family: var(--mono); font-size: 12px; }
    .muted { color: var(--muted); }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      background: var(--surface-2);
    }
    .badge-win { background: rgba(52, 211, 153, 0.18); color: var(--green); }
    .badge-broke { background: rgba(248, 113, 113, 0.18); color: var(--red); }
    .badge-time { background: rgba(251, 191, 36, 0.18); color: var(--amber); }
    .badge-abandoned { background: rgba(148, 163, 184, 0.18); color: var(--muted); }
    .bar-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .bar-label { width: 100px; font-size: 12px; color: var(--muted); }
    .bar-track {
      flex: 1;
      height: 10px;
      background: var(--bg);
      border-radius: 999px;
      overflow: hidden;
    }
    .bar-fill { height: 100%; background: var(--accent); }
    .bar-val { width: 70px; text-align: right; font-variant-numeric: tabular-nums; font-size: 12px; }
    .scroll-x { overflow-x: auto; }
    pre.json-box {
      margin: 0;
      font-family: var(--mono);
      font-size: 11.5px;
      white-space: pre-wrap;
      word-break: break-word;
      max-width: 420px;
      max-height: 140px;
      overflow: auto;
      background: var(--bg);
      padding: 6px;
      border-radius: 4px;
      border: 1px solid var(--border);
    }
    .status-msg {
      padding: 8px 12px;
      border-radius: 6px;
      margin-bottom: 12px;
      font-size: 13px;
      background: var(--surface-2);
      border: 1px solid var(--border);
    }
    .status-msg.error { border-color: var(--red); color: var(--red); }
    .status-msg.ok { border-color: var(--green); color: var(--green); }
    .hidden { display: none; }
    .pagination {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 10px;
      font-size: 12px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <header>
    <h1>Fit or Pivot — Admin Telemetry</h1>
    <div class="header-actions">
      <a class="btn-link" href="/api/admin/export?type=runs&amp;format=csv">Export Runs CSV</a>
      <a class="btn-link" href="/api/admin/export?type=runs&amp;format=json">Export Runs JSON</a>
      <a class="btn-link" href="/api/admin/export?type=events&amp;format=csv">Export Events CSV</a>
      <a class="btn-link" href="/api/admin/export?type=events&amp;format=json">Export Events JSON</a>
    </div>
  </header>

  <nav class="tabs" id="tabs">
    <button type="button" class="active" data-tab="overview">Overview &amp; Funnel</button>
    <button type="button" data-tab="runs">Runs Explorer &amp; Timeline</button>
    <button type="button" data-tab="friction">UX Friction &amp; Balance</button>
    <button type="button" data-tab="events">Events &amp; IPs</button>
    <button type="button" data-tab="errors">Errors</button>
    <button type="button" data-tab="prune">Prune Data</button>
  </nav>

  <main>
    <div id="globalStatus" class="status-msg hidden"></div>

    <!-- OVERVIEW TAB -->
    <section id="tab-overview" class="panel active">
      <div class="toolbar">
        <label class="field">Range
          <select id="overviewRange">
            <option value="">All time</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>
        <button type="button" class="btn btn-primary" id="refreshOverviewBtn">Refresh</button>
      </div>
      <div id="overviewKpis" class="grid-kpis"></div>
      <div class="grid-2">
        <div class="card">
          <h2>Outcome Breakdown</h2>
          <div id="overviewOutcomes"></div>
        </div>
        <div class="card">
          <h2>Screen Drop-off Funnel (Abandoned Runs)</h2>
          <div id="overviewDropoff" class="scroll-x"></div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h2>Segment Performance</h2>
          <div id="overviewSegments" class="scroll-x"></div>
        </div>
        <div class="card">
          <h2>Top IPs</h2>
          <div id="overviewIps" class="scroll-x"></div>
        </div>
      </div>
    </section>

    <!-- RUNS TAB -->
    <section id="tab-runs" class="panel">
      <div class="toolbar">
        <input id="runsQuery" type="text" placeholder="Search name, idea, runId, IP..." style="min-width:220px" />
        <select id="runsOutcome">
          <option value="">All outcomes</option>
          <option value="win">Win</option>
          <option value="broke">Broke</option>
          <option value="time">Time</option>
          <option value="abandoned">Abandoned</option>
        </select>
        <input id="runsSegment" type="text" placeholder="Segment (e.g. consumer)" style="width:150px" />
        <input id="runsIp" type="text" placeholder="Filter by IP" style="width:140px" />
        <label class="field"><input id="runsAbandonedOnly" type="checkbox" /> Abandoned only</label>
        <button type="button" class="btn btn-primary" id="runsSearchBtn">Filter</button>
        <button type="button" class="btn" id="runsResetBtn">Reset</button>
      </div>
      <div class="card">
        <div id="runsTableWrap" class="scroll-x"></div>
        <div class="pagination">
          <span id="runsPageInfo"></span>
          <div>
            <button type="button" class="btn btn-sm" id="runsPrevBtn">Prev</button>
            <button type="button" class="btn btn-sm" id="runsNextBtn">Next</button>
          </div>
        </div>
      </div>
      <div id="runDetailCard" class="card hidden"></div>
    </section>

    <!-- FRICTION & BALANCE TAB -->
    <section id="tab-friction" class="panel">
      <div class="toolbar">
        <label class="field">Range
          <select id="frictionRange">
            <option value="">All time</option>
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </label>
        <button type="button" class="btn btn-primary" id="refreshFrictionBtn">Refresh</button>
      </div>
      <div id="frictionKpis" class="grid-kpis"></div>
      <div class="grid-2">
        <div class="card">
          <h2>Disabled Clicks Breakdown</h2>
          <div id="frictionDisabled" class="scroll-x"></div>
        </div>
        <div class="card">
          <h2>Modal Cancellations Breakdown</h2>
          <div id="frictionModals" class="scroll-x"></div>
        </div>
      </div>
      <div class="card">
        <h2>Screen Dwell Times</h2>
        <div id="frictionDwell" class="scroll-x"></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h2>Balance by Segment</h2>
          <div id="balanceSegment" class="scroll-x"></div>
        </div>
        <div class="card">
          <h2>Balance by Feature</h2>
          <div id="balanceFeature" class="scroll-x"></div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <h2>Balance by Style</h2>
          <div id="balanceStyle" class="scroll-x"></div>
        </div>
        <div class="card">
          <h2>Balance by Pivots &amp; Interviews</h2>
          <div id="balancePivotsInterviews" class="scroll-x"></div>
        </div>
      </div>
    </section>

    <!-- EVENTS TAB -->
    <section id="tab-events" class="panel">
      <div class="toolbar">
        <input id="evRunId" type="text" placeholder="runId" style="width:180px" />
        <input id="evSessionId" type="text" placeholder="sessionId" style="width:180px" />
        <input id="evIp" type="text" placeholder="IP" style="width:130px" />
        <input id="evType" type="text" placeholder="eventType (e.g. month.simulated)" style="width:190px" />
        <input id="evAction" type="text" placeholder="actionType" style="width:140px" />
        <select id="evLimit">
          <option value="100">100</option>
          <option value="250">250</option>
          <option value="500">500</option>
        </select>
        <button type="button" class="btn btn-primary" id="eventsSearchBtn">Query</button>
      </div>
      <div class="card">
        <div id="eventsTableWrap" class="scroll-x"></div>
      </div>
    </section>

    <!-- ERRORS TAB -->
    <section id="tab-errors" class="panel">
      <div class="toolbar">
        <select id="errorsLimit">
          <option value="100">Last 100</option>
          <option value="250">Last 250</option>
          <option value="500">Last 500</option>
        </select>
        <button type="button" class="btn btn-primary" id="refreshErrorsBtn">Refresh</button>
      </div>
      <div class="card">
        <div id="errorsTableWrap" class="scroll-x"></div>
      </div>
    </section>

    <!-- PRUNE TAB -->
    <section id="tab-prune" class="panel">
      <div class="card" style="max-width:560px">
        <h2>Prune Telemetry Data</h2>
        <p class="muted">Delete runs, sessions, events, and client errors matching an IP address and/or older than N days.</p>
        <form id="pruneForm" style="display:flex;flex-direction:column;gap:12px">
          <label class="field" style="justify-content:space-between">
            <span>Target IP (optional)</span>
            <input id="pruneIp" type="text" placeholder="e.g. 203.0.113.5" style="width:260px" />
          </label>
          <label class="field" style="justify-content:space-between">
            <span>Older than days (optional, 0 = all)</span>
            <input id="pruneDays" type="number" min="0" step="1" placeholder="e.g. 30" style="width:260px" />
          </label>
          <div>
            <button type="submit" class="btn btn-danger">Prune Matching Data</button>
          </div>
        </form>
        <div id="pruneResult" style="margin-top:12px"></div>
      </div>
    </section>
  </main>

  <script>
    (function () {
      'use strict';

      var state = {
        runsOffset: 0,
        runsLimit: 50,
        runsTotal: 0,
        selectedRunId: null
      };

      function esc(val) {
        if (val === null || val === undefined) return '';
        return String(val)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      function fmtTime(ms) {
        if (!ms || !Number.isFinite(Number(ms))) return '-';
        const d = new Date(Number(ms));
        if (Number.isNaN(d.getTime())) return '-';
        return d.toISOString().replace('T', ' ').slice(0, 19);
      }

      function fmtNum(n) {
        if (n === null || n === undefined || !Number.isFinite(Number(n))) return '-';
        return Number(n).toLocaleString();
      }

      function fmtCash(n) {
        if (n === null || n === undefined || !Number.isFinite(Number(n))) return '-';
        return '€' + Number(n).toLocaleString();
      }

      function fmtPct(rate) {
        if (rate === null || rate === undefined || !Number.isFinite(Number(rate))) return '0%';
        return (Number(rate) * 100).toFixed(1) + '%';
      }

      function rangeToParams(rangeVal) {
        if (!rangeVal) return '';
        var now = Date.now();
        var ms = 0;
        if (rangeVal === '24h') ms = 86400000;
        else if (rangeVal === '7d') ms = 7 * 86400000;
        else if (rangeVal === '30d') ms = 30 * 86400000;
        return ms > 0 ? '?from=' + (now - ms) + '&to=' + now : '';
      }

      function showStatus(msg, kind) {
        var el = document.getElementById('globalStatus');
        el.textContent = msg;
        el.className = 'status-msg ' + (kind || '');
        if (!msg) el.classList.add('hidden');
      }

      async function apiFetch(url, opts) {
        var target = url.charAt(0) === '/' ? window.location.origin + url : url;
        var res = await fetch(target, opts);
        var text = await res.text();
        var data = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch (e) {
          data = { error: text || res.statusText };
        }
        if (!res.ok) {
          throw new Error((data && data.error) || ('HTTP ' + res.status));
        }
        return data;
      }

      function outcomeBadge(reason) {
        var label = reason || 'abandoned';
        var cls = 'badge-abandoned';
        if (label === 'win') cls = 'badge-win';
        else if (label === 'broke') cls = 'badge-broke';
        else if (label === 'time') cls = 'badge-time';
        return '<span class="badge ' + cls + '">' + esc(label) + '</span>';
      }

      function switchTab(tabName) {
        var buttons = document.querySelectorAll('#tabs button');
        for (var i = 0; i < buttons.length; i++) {
          buttons[i].classList.toggle('active', buttons[i].getAttribute('data-tab') === tabName);
        }
        var panels = document.querySelectorAll('main .panel');
        for (var j = 0; j < panels.length; j++) {
          panels[j].classList.toggle('active', panels[j].id === 'tab-' + tabName);
        }
        if (tabName === 'overview') loadOverview();
        else if (tabName === 'runs') loadRuns();
        else if (tabName === 'friction') loadFrictionAndBalance();
        else if (tabName === 'events') loadEvents();
        else if (tabName === 'errors') loadErrors();
      }

      document.getElementById('tabs').addEventListener('click', function (e) {
        var btn = e.target.closest('button[data-tab]');
        if (btn) switchTab(btn.getAttribute('data-tab'));
      });

      // --- OVERVIEW ---
      async function loadOverview() {
        try {
          showStatus('', '');
          var qs = rangeToParams(document.getElementById('overviewRange').value);
          var data = await apiFetch('/api/admin/overview' + qs);
          var winRate = data.runs > 0 ? data.outcomes.win / data.runs : 0;

          document.getElementById('overviewKpis').innerHTML =
            '<div class="card"><div class="kpi-label">Sessions</div><div class="kpi-value">' + fmtNum(data.sessions) + '</div></div>' +
            '<div class="card"><div class="kpi-label">Total Runs</div><div class="kpi-value">' + fmtNum(data.runs) + '</div></div>' +
            '<div class="card"><div class="kpi-label">Unique IPs</div><div class="kpi-value">' + fmtNum(data.uniqueIps) + '</div></div>' +
            '<div class="card"><div class="kpi-label">Win Rate</div><div class="kpi-value">' + fmtPct(winRate) + '</div><div class="kpi-sub">' + fmtNum(data.outcomes.win) + ' wins</div></div>';

          var total = Math.max(data.runs, 1);
          var outcomes = [
            { key: 'Win', val: data.outcomes.win, color: 'var(--green)' },
            { key: 'Broke', val: data.outcomes.broke, color: 'var(--red)' },
            { key: 'Time Out', val: data.outcomes.time, color: 'var(--amber)' },
            { key: 'Abandoned', val: data.outcomes.abandoned, color: 'var(--muted)' }
          ];
          document.getElementById('overviewOutcomes').innerHTML = outcomes.map(function (o) {
            var pct = ((o.val / total) * 100).toFixed(1);
            return '<div class="bar-row">' +
              '<span class="bar-label">' + esc(o.key) + '</span>' +
              '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + o.color + '"></div></div>' +
              '<span class="bar-val">' + fmtNum(o.val) + ' (' + pct + '%)</span>' +
              '</div>';
          }).join('');

          document.getElementById('overviewDropoff').innerHTML = data.screenDropoff.length
            ? '<table><thead><tr><th>Screen</th><th>Abandoned Runs</th></tr></thead><tbody>' +
              data.screenDropoff.map(function (r) {
                return '<tr><td class="mono">' + esc(r.screen) + '</td><td>' + fmtNum(r.count) + '</td></tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">No abandoned runs in range.</p>';

          document.getElementById('overviewSegments').innerHTML = data.segmentStats.length
            ? '<table><thead><tr><th>Segment</th><th>Runs</th><th>Wins</th><th>Win Rate</th><th>Avg Cash</th><th>Avg Months</th></tr></thead><tbody>' +
              data.segmentStats.map(function (s) {
                return '<tr><td class="mono">' + esc(s.segment) + '</td><td>' + fmtNum(s.runs) + '</td><td>' + fmtNum(s.wins) + '</td><td>' + fmtPct(s.winRate) + '</td><td>' + fmtCash(s.avgFinalCash) + '</td><td>' + esc(s.avgMonths) + '</td></tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">No segment data yet.</p>';

          document.getElementById('overviewIps').innerHTML = data.topIps.length
            ? '<table><thead><tr><th>IP</th><th>Sessions</th><th>Runs</th><th>Last Seen</th><th>Actions</th></tr></thead><tbody>' +
              data.topIps.map(function (row) {
                return '<tr>' +
                  '<td class="mono">' + esc(row.ip) + '</td>' +
                  '<td>' + fmtNum(row.sessions) + '</td>' +
                  '<td>' + fmtNum(row.runs) + '</td>' +
                  '<td class="mono">' + fmtTime(row.lastSeenAt) + '</td>' +
                  '<td>' +
                    '<button type="button" class="btn btn-sm" data-filter-ip="' + esc(row.ip) + '">Filter Runs</button> ' +
                    '<button type="button" class="btn btn-sm btn-danger" data-prune-ip="' + esc(row.ip) + '">Prune</button>' +
                  '</td>' +
                '</tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">No IP data yet.</p>';
        } catch (err) {
          showStatus('Overview error: ' + err.message, 'error');
        }
      }

      document.getElementById('refreshOverviewBtn').addEventListener('click', loadOverview);
      document.getElementById('overviewRange').addEventListener('change', loadOverview);

      document.getElementById('overviewIps').addEventListener('click', async function (e) {
        var filterBtn = e.target.closest('button[data-filter-ip]');
        if (filterBtn) {
          document.getElementById('runsIp').value = filterBtn.getAttribute('data-filter-ip') || '';
          state.runsOffset = 0;
          switchTab('runs');
          return;
        }
        var pruneBtn = e.target.closest('button[data-prune-ip]');
        if (pruneBtn) {
          var ip = pruneBtn.getAttribute('data-prune-ip');
          if (!ip || !confirm('Prune all telemetry data for IP ' + ip + '?')) return;
          try {
            var res = await apiFetch('/api/admin/prune', {
              method: 'POST',
              headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' },
              body: JSON.stringify({ ip: ip })
            });
            showStatus('Pruned IP ' + ip + ': ' + res.deletedRuns + ' runs, ' + res.deletedEvents + ' events, ' + res.deletedSessions + ' sessions.', 'ok');
            loadOverview();
          } catch (err) {
            showStatus('Prune failed: ' + err.message, 'error');
          }
        }
      });

      // --- RUNS ---
      async function loadRuns() {
        try {
          showStatus('', '');
          var params = new URLSearchParams();
          var q = document.getElementById('runsQuery').value.trim();
          var outcome = document.getElementById('runsOutcome').value;
          var segment = document.getElementById('runsSegment').value.trim();
          var ip = document.getElementById('runsIp').value.trim();
          var abandonedOnly = document.getElementById('runsAbandonedOnly').checked;

          if (q) params.set('q', q);
          if (outcome) params.set('outcome', outcome);
          if (segment) params.set('segment', segment);
          if (ip) params.set('ip', ip);
          if (abandonedOnly) params.set('abandonedOnly', 'true');
          params.set('limit', String(state.runsLimit));
          params.set('offset', String(state.runsOffset));

          var data = await apiFetch('/api/admin/runs?' + params.toString());
          state.runsTotal = data.total;

          document.getElementById('runsPageInfo').textContent =
            'Showing ' + (data.total === 0 ? 0 : data.offset + 1) + '-' + (data.offset + data.runs.length) + ' of ' + data.total;
          document.getElementById('runsPrevBtn').disabled = data.offset <= 0;
          document.getElementById('runsNextBtn').disabled = data.offset + data.runs.length >= data.total;

          document.getElementById('runsTableWrap').innerHTML = data.runs.length
            ? '<table><thead><tr><th>Run ID</th><th>Product</th><th>Outcome</th><th>Screen</th><th>Segment</th><th>Mo</th><th>Cash</th><th>VD / Ret / Sat</th><th>Score</th><th>IP</th><th>Updated</th></tr></thead><tbody>' +
              data.runs.map(function (r) {
                var selected = state.selectedRunId === r.run_id ? ' selected' : '';
                return '<tr class="clickable' + selected + '" data-run-id="' + esc(r.run_id) + '">' +
                  '<td class="mono">' + esc(r.run_id.slice(0, 12)) + '</td>' +
                  '<td><strong>' + esc(r.product_name || '(unnamed)') + '</strong><div class="muted" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.product_idea) + '</div></td>' +
                  '<td>' + outcomeBadge(r.ended_reason) + '</td>' +
                  '<td class="mono">' + esc(r.current_screen) + '</td>' +
                  '<td class="mono">' + esc(r.last_segment || '-') + '</td>' +
                  '<td>' + esc(r.final_month) + '</td>' +
                  '<td>' + fmtCash(r.final_cash) + '</td>' +
                  '<td class="mono">' + esc(r.final_vd) + ' / ' + esc(r.final_ret) + ' / ' + esc(r.final_sat) + '</td>' +
                  '<td>' + (r.score !== null && r.score !== undefined ? esc(r.score) : '-') + '</td>' +
                  '<td class="mono">' + esc(r.ip) + '</td>' +
                  '<td class="mono">' + fmtTime(r.updated_at) + '</td>' +
                '</tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">No runs match the current filters.</p>';
        } catch (err) {
          showStatus('Runs error: ' + err.message, 'error');
        }
      }

      async function loadRunDetail(runId) {
        try {
          state.selectedRunId = runId;
          var data = await apiFetch('/api/admin/runs/' + encodeURIComponent(runId));
          var r = data.run;
          var card = document.getElementById('runDetailCard');
          card.classList.remove('hidden');

          var monthsHtml = data.months.length
            ? '<table><thead><tr><th>Mo</th><th>Decision</th><th>Segment</th><th>Style</th><th>Features</th><th>VD</th><th>Ret</th><th>Sat</th><th>Cash</th><th>Cost</th><th>Int Spend</th><th>Duration</th></tr></thead><tbody>' +
              data.months.map(function (m) {
                return '<tr>' +
                  '<td>' + esc(m.month) + '</td>' +
                  '<td class="mono">' + esc(m.decision) + '</td>' +
                  '<td class="mono">' + esc(m.segment) + '</td>' +
                  '<td class="mono">' + esc(m.style) + '</td>' +
                  '<td class="mono">' + esc(m.features_json) + '</td>' +
                  '<td>' + esc(m.vd) + '</td>' +
                  '<td>' + esc(m.ret) + '</td>' +
                  '<td>' + esc(m.sat) + '</td>' +
                  '<td>' + fmtCash(m.cash) + '</td>' +
                  '<td>' + fmtCash(m.cost) + '</td>' +
                  '<td>' + fmtCash(m.interview_spend) + '</td>' +
                  '<td>' + (m.duration_ms != null ? esc(m.duration_ms) + 'ms' : '-') + '</td>' +
                '</tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">No simulated months recorded.</p>';

          var eventsHtml = data.events.length
            ? '<table><thead><tr><th>Seq</th><th>Time</th><th>Event</th><th>Action</th><th>Transition</th><th>Duration</th><th>Payload</th><th>State</th></tr></thead><tbody>' +
              data.events.map(function (ev) {
                var trans = (ev.screen_from || ev.screen_to) ? esc(ev.screen_from || '') + ' &rarr; ' + esc(ev.screen_to || '') : '-';
                return '<tr>' +
                  '<td>' + esc(ev.seq) + '</td>' +
                  '<td class="mono">' + fmtTime(ev.ts) + '</td>' +
                  '<td class="mono">' + esc(ev.event_type) + '</td>' +
                  '<td class="mono">' + esc(ev.action_type || '-') + '</td>' +
                  '<td class="mono">' + trans + '</td>' +
                  '<td>' + (ev.duration_ms != null ? esc(ev.duration_ms) + 'ms' : '-') + '</td>' +
                  '<td>' + (ev.payload_json ? '<pre class="json-box">' + esc(ev.payload_json) + '</pre>' : '-') + '</td>' +
                  '<td>' + (ev.state_json ? '<pre class="json-box">' + esc(ev.state_json) + '</pre>' : '-') + '</td>' +
                '</tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">No events recorded.</p>';

          card.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px">' +
              '<div>' +
                '<h2 style="margin-bottom:4px">Run: <span class="mono">' + esc(r.run_id) + '</span> ' + outcomeBadge(r.ended_reason) + '</h2>' +
                '<div class="muted">Session: <span class="mono">' + esc(r.session_id) + '</span> &middot; IP: <span class="mono">' + esc(r.ip) + '</span> &middot; Style: <span class="mono">' + esc(r.initial_style || '-') + '</span> &middot; Pivots: ' + esc(r.pivots) + ' &middot; Interviews: ' + esc(r.interviews) + '</div>' +
                '<div style="margin-top:6px"><strong>' + esc(r.product_name || '(unnamed)') + '</strong> — ' + esc(r.product_idea || '') + '</div>' +
              '</div>' +
              '<button type="button" class="btn btn-danger btn-sm" id="deleteRunBtn" data-delete-run="' + esc(r.run_id) + '">Delete Run</button>' +
            '</div>' +
            '<h3>Month-by-Month Progression</h3><div class="scroll-x" style="margin-bottom:16px">' + monthsHtml + '</div>' +
            '<h3>Event Timeline (' + data.events.length + ')</h3><div class="scroll-x">' + eventsHtml + '</div>';
        } catch (err) {
          showStatus('Run detail error: ' + err.message, 'error');
        }
      }

      document.getElementById('runsSearchBtn').addEventListener('click', function () {
        state.runsOffset = 0;
        loadRuns();
      });
      document.getElementById('runsResetBtn').addEventListener('click', function () {
        document.getElementById('runsQuery').value = '';
        document.getElementById('runsOutcome').value = '';
        document.getElementById('runsSegment').value = '';
        document.getElementById('runsIp').value = '';
        document.getElementById('runsAbandonedOnly').checked = false;
        state.runsOffset = 0;
        loadRuns();
      });
      document.getElementById('runsPrevBtn').addEventListener('click', function () {
        state.runsOffset = Math.max(0, state.runsOffset - state.runsLimit);
        loadRuns();
      });
      document.getElementById('runsNextBtn').addEventListener('click', function () {
        if (state.runsOffset + state.runsLimit < state.runsTotal) {
          state.runsOffset += state.runsLimit;
          loadRuns();
        }
      });
      document.getElementById('runsTableWrap').addEventListener('click', function (e) {
        var tr = e.target.closest('tr[data-run-id]');
        if (tr) {
          var runId = tr.getAttribute('data-run-id');
          if (runId) {
            loadRunDetail(runId);
            loadRuns();
          }
        }
      });
      document.getElementById('runDetailCard').addEventListener('click', async function (e) {
        var btn = e.target.closest('button[data-delete-run]');
        if (!btn) return;
        var runId = btn.getAttribute('data-delete-run');
        if (!runId || !confirm('Delete run ' + runId + ' and all its events?')) return;
        try {
          await apiFetch('/api/admin/runs/' + encodeURIComponent(runId), {
            method: 'DELETE',
            headers: { 'x-requested-with': 'fetch' }
          });
          document.getElementById('runDetailCard').classList.add('hidden');
          state.selectedRunId = null;
          showStatus('Deleted run ' + runId, 'ok');
          loadRuns();
        } catch (err) {
          showStatus('Delete failed: ' + err.message, 'error');
        }
      });

      // --- FRICTION & BALANCE ---
      function renderBalanceTable(rows, keyName, label) {
        if (!rows || rows.length === 0) return '<p class="muted">No data yet.</p>';
        return '<table><thead><tr><th>' + esc(label) + '</th><th>Runs</th><th>Wins</th><th>Win Rate</th><th>Avg VD</th><th>Avg Ret</th><th>Avg Sat</th><th>Avg Cash</th><th>Avg Mo</th></tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr><td class="mono">' + esc(r[keyName]) + '</td><td>' + fmtNum(r.runs) + '</td><td>' + fmtNum(r.wins) + '</td><td>' + fmtPct(r.winRate) + '</td><td>' + esc(r.avgVd) + '</td><td>' + esc(r.avgRet) + '</td><td>' + esc(r.avgSat) + '</td><td>' + fmtCash(r.avgCash) + '</td><td>' + esc(r.avgMonths) + '</td></tr>';
          }).join('') + '</tbody></table>';
      }

      async function loadFrictionAndBalance() {
        try {
          showStatus('', '');
          var qs = rangeToParams(document.getElementById('frictionRange').value);
          var results = await Promise.all([
            apiFetch('/api/admin/friction' + qs),
            apiFetch('/api/admin/balance' + qs)
          ]);
          var f = results[0];
          var b = results[1];

          document.getElementById('frictionKpis').innerHTML =
            '<div class="card"><div class="kpi-label">Disabled Clicks</div><div class="kpi-value">' + fmtNum(f.disabledClicks.total) + '</div></div>' +
            '<div class="card"><div class="kpi-label">Modal Cancellations</div><div class="kpi-value">' + fmtNum(f.modalCancellations.total) + '</div></div>' +
            '<div class="card"><div class="kpi-label">Setup Errors</div><div class="kpi-value">' + fmtNum(f.setupErrors) + '</div></div>' +
            '<div class="card"><div class="kpi-label">Pick Limit Hits</div><div class="kpi-value">' + fmtNum(f.pickLimitHits) + '</div></div>';

          document.getElementById('frictionDisabled').innerHTML = f.disabledClicks.breakdown.length
            ? '<table><thead><tr><th>Screen</th><th>Action</th><th>Count</th></tr></thead><tbody>' +
              f.disabledClicks.breakdown.map(function (r) {
                return '<tr><td class="mono">' + esc(r.screen || '-') + '</td><td class="mono">' + esc(r.actionType || '-') + '</td><td>' + fmtNum(r.count) + '</td></tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">None recorded.</p>';

          document.getElementById('frictionModals').innerHTML = f.modalCancellations.breakdown.length
            ? '<table><thead><tr><th>Screen</th><th>Action</th><th>Count</th></tr></thead><tbody>' +
              f.modalCancellations.breakdown.map(function (r) {
                return '<tr><td class="mono">' + esc(r.screen || '-') + '</td><td class="mono">' + esc(r.actionType || '-') + '</td><td>' + fmtNum(r.count) + '</td></tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">None recorded.</p>';

          document.getElementById('frictionDwell').innerHTML = f.screenDwellMs.length
            ? '<table><thead><tr><th>Screen</th><th>Samples</th><th>Avg Dwell</th><th>Total Dwell</th></tr></thead><tbody>' +
              f.screenDwellMs.map(function (r) {
                return '<tr><td class="mono">' + esc(r.screen) + '</td><td>' + fmtNum(r.count) + '</td><td>' + fmtNum(r.avgMs) + ' ms</td><td>' + fmtNum(r.totalMs) + ' ms</td></tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">No dwell times recorded.</p>';

          document.getElementById('balanceSegment').innerHTML = renderBalanceTable(b.bySegment, 'segment', 'Segment');
          document.getElementById('balanceFeature').innerHTML = renderBalanceTable(b.byFeature, 'feature', 'Feature');
          document.getElementById('balanceStyle').innerHTML = renderBalanceTable(b.byStyle, 'style', 'Style');
          document.getElementById('balancePivotsInterviews').innerHTML =
            '<h3 style="margin-top:0">By Pivots</h3>' + renderBalanceTable(b.byPivots, 'pivots', 'Pivots') +
            '<h3 style="margin-top:14px">By Interviews</h3>' + renderBalanceTable(b.byInterviews, 'interviews', 'Interviews');
        } catch (err) {
          showStatus('Friction & Balance error: ' + err.message, 'error');
        }
      }

      document.getElementById('refreshFrictionBtn').addEventListener('click', loadFrictionAndBalance);
      document.getElementById('frictionRange').addEventListener('change', loadFrictionAndBalance);

      // --- EVENTS ---
      async function loadEvents() {
        try {
          showStatus('', '');
          var params = new URLSearchParams();
          var runId = document.getElementById('evRunId').value.trim();
          var sessionId = document.getElementById('evSessionId').value.trim();
          var ip = document.getElementById('evIp').value.trim();
          var eventType = document.getElementById('evType').value.trim();
          var actionType = document.getElementById('evAction').value.trim();
          var limit = document.getElementById('evLimit').value;

          if (runId) params.set('runId', runId);
          if (sessionId) params.set('sessionId', sessionId);
          if (ip) params.set('ip', ip);
          if (eventType) params.set('eventType', eventType);
          if (actionType) params.set('actionType', actionType);
          params.set('limit', limit);

          var data = await apiFetch('/api/admin/events?' + params.toString());
          document.getElementById('eventsTableWrap').innerHTML = data.events.length
            ? '<table><thead><tr><th>Time</th><th>Seq</th><th>Run ID</th><th>IP</th><th>Event</th><th>Action</th><th>Transition</th><th>Duration</th><th>Payload</th></tr></thead><tbody>' +
              data.events.map(function (ev) {
                var trans = (ev.screen_from || ev.screen_to) ? esc(ev.screen_from || '') + ' &rarr; ' + esc(ev.screen_to || '') : '-';
                return '<tr>' +
                  '<td class="mono">' + fmtTime(ev.ts) + '</td>' +
                  '<td>' + esc(ev.seq) + '</td>' +
                  '<td class="mono">' + esc(ev.run_id.slice(0, 12)) + '</td>' +
                  '<td class="mono">' + esc(ev.ip) + '</td>' +
                  '<td class="mono">' + esc(ev.event_type) + '</td>' +
                  '<td class="mono">' + esc(ev.action_type || '-') + '</td>' +
                  '<td class="mono">' + trans + '</td>' +
                  '<td>' + (ev.duration_ms != null ? esc(ev.duration_ms) + 'ms' : '-') + '</td>' +
                  '<td>' + (ev.payload_json ? '<pre class="json-box">' + esc(ev.payload_json) + '</pre>' : '-') + '</td>' +
                '</tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">No events found.</p>';
        } catch (err) {
          showStatus('Events error: ' + err.message, 'error');
        }
      }
      document.getElementById('eventsSearchBtn').addEventListener('click', loadEvents);

      // --- ERRORS ---
      async function loadErrors() {
        try {
          showStatus('', '');
          var limit = document.getElementById('errorsLimit').value;
          var data = await apiFetch('/api/admin/errors?limit=' + encodeURIComponent(limit));
          document.getElementById('errorsTableWrap').innerHTML = data.errors.length
            ? '<table><thead><tr><th>Time</th><th>IP</th><th>Run ID</th><th>Screen</th><th>Source</th><th>Message</th><th>Stack</th></tr></thead><tbody>' +
              data.errors.map(function (er) {
                return '<tr>' +
                  '<td class="mono">' + fmtTime(er.ts) + '</td>' +
                  '<td class="mono">' + esc(er.ip) + '</td>' +
                  '<td class="mono">' + esc(er.run_id) + '</td>' +
                  '<td class="mono">' + esc(er.screen || '-') + '</td>' +
                  '<td class="mono">' + esc(er.source || '-') + '</td>' +
                  '<td>' + esc(er.message) + '</td>' +
                  '<td>' + (er.stack ? '<pre class="json-box">' + esc(er.stack) + '</pre>' : '-') + '</td>' +
                '</tr>';
              }).join('') + '</tbody></table>'
            : '<p class="muted">No client errors recorded.</p>';
        } catch (err) {
          showStatus('Errors load failed: ' + err.message, 'error');
        }
      }
      document.getElementById('refreshErrorsBtn').addEventListener('click', loadErrors);

      // --- PRUNE ---
      document.getElementById('pruneForm').addEventListener('submit', async function (e) {
        e.preventDefault();
        var ip = document.getElementById('pruneIp').value.trim();
        var daysRaw = document.getElementById('pruneDays').value.trim();
        if (!ip && daysRaw === '') {
          showStatus('Enter an IP address and/or olderThanDays.', 'error');
          return;
        }
        var body = {};
        if (ip) body.ip = ip;
        if (daysRaw !== '') body.olderThanDays = Number(daysRaw);
        if (!confirm('Are you sure you want to permanently prune matching telemetry data?')) return;
        try {
          var res = await apiFetch('/api/admin/prune', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'x-requested-with': 'fetch' },
            body: JSON.stringify(body)
          });
          document.getElementById('pruneResult').innerHTML =
            '<div class="status-msg ok">Pruned: ' + fmtNum(res.deletedRuns) + ' runs, ' +
            fmtNum(res.deletedSessions) + ' sessions, ' +
            fmtNum(res.deletedEvents) + ' events, ' +
            fmtNum(res.deletedErrors) + ' errors.</div>';
        } catch (err) {
          showStatus('Prune failed: ' + err.message, 'error');
        }
      });

      // Initial load
      loadOverview();
    })();
  </script>
</body>
</html>`;
}
