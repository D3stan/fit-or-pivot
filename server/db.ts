import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';
import type { TelemetryBatch, TelemetryEvent } from '../src/shared/telemetry.js';

export interface IngestMeta {
  ip: string;
  userAgent: string;
  receivedAt: number;
}

export interface IngestResult {
  accepted: number;
  inserted: number;
}

export interface TimeRangeOpts {
  from?: number;
  to?: number;
}

export interface RunListOpts {
  outcome?: string;
  segment?: string;
  ip?: string;
  q?: string;
  abandonedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface EventQueryOpts {
  runId?: string;
  sessionId?: string;
  ip?: string;
  eventType?: string;
  actionType?: string;
  limit?: number;
}

export interface PruneOpts {
  ip?: string;
  olderThanMs?: number;
}

export interface PruneResult {
  deletedRuns: number;
  deletedSessions: number;
  deletedEvents: number;
  deletedErrors: number;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  session_id TEXT PRIMARY KEY,
  first_seen_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  ip TEXT NOT NULL,
  user_agent TEXT NOT NULL,
  viewport_w INTEGER,
  viewport_h INTEGER,
  reduced_motion INTEGER,
  referrer TEXT,
  locale TEXT,
  timezone TEXT
);

CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  ip TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ended_at INTEGER,
  product_name TEXT NOT NULL DEFAULT '',
  product_idea TEXT NOT NULL DEFAULT '',
  initial_style TEXT,
  current_screen TEXT NOT NULL DEFAULT 'intro',
  ended_reason TEXT,
  final_month INTEGER NOT NULL DEFAULT 0,
  final_cash INTEGER NOT NULL DEFAULT 100000,
  final_vd INTEGER NOT NULL DEFAULT 0,
  final_ret INTEGER NOT NULL DEFAULT 0,
  final_sat INTEGER NOT NULL DEFAULT 50,
  pivots INTEGER NOT NULL DEFAULT 0,
  interviews INTEGER NOT NULL DEFAULT 0,
  score INTEGER,
  event_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS run_months (
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  month INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  decision TEXT NOT NULL,
  segment TEXT NOT NULL,
  features_json TEXT NOT NULL,
  style TEXT NOT NULL,
  vd INTEGER NOT NULL,
  ret INTEGER NOT NULL,
  sat INTEGER NOT NULL,
  cash INTEGER NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  interview_spend INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  PRIMARY KEY (run_id, month)
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  seq INTEGER NOT NULL,
  session_id TEXT NOT NULL REFERENCES sessions(session_id),
  run_id TEXT NOT NULL REFERENCES runs(run_id),
  ip TEXT NOT NULL,
  event_type TEXT NOT NULL,
  action_type TEXT,
  screen_from TEXT,
  screen_to TEXT,
  duration_ms INTEGER,
  payload_json TEXT,
  state_json TEXT,
  UNIQUE(session_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_events_run_seq ON events(run_id, seq);
CREATE INDEX IF NOT EXISTS idx_events_session_ts ON events(session_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_type_ts ON events(event_type, ts);
CREATE INDEX IF NOT EXISTS idx_events_ip_ts ON events(ip, ts);

CREATE TABLE IF NOT EXISTS client_errors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  ip TEXT NOT NULL,
  screen TEXT,
  message TEXT NOT NULL,
  stack TEXT,
  source TEXT
);
`;

export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors if transaction was already aborted
    }
    throw err;
  }
}

export function openDatabase(dbPath?: string): DatabaseSync {
  const resolvedPath = dbPath ?? path.join(process.env.DATA_DIR || './data', 'telemetry.db');
  if (resolvedPath !== ':memory:') {
    mkdirSync(path.dirname(resolvedPath), { recursive: true });
  }
  const db = new DatabaseSync(resolvedPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  db.exec(SCHEMA_SQL);
  return db;
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}

function asNumber(val: unknown, fallback = 0): number {
  return typeof val === 'number' && Number.isFinite(val) ? Math.trunc(val) : fallback;
}

function extractMonthRow(ev: TelemetryEvent): {
  month: number;
  decision: string;
  segment: string;
  featuresJson: string;
  style: string;
  vd: number;
  ret: number;
  sat: number;
  cash: number;
  cost: number;
  interviewSpend: number;
  durationMs: number | null;
} | null {
  const payload = ev.payload ?? {};
  const row = (typeof payload.row === 'object' && payload.row !== null
    ? payload.row
    : payload) as Record<string, unknown>;

  const month = typeof row.month === 'number' ? Math.trunc(row.month) : ev.state?.month;
  const decision = asString(row.decision, ev.state?.lastDecision ?? '');
  const segment = asString(row.segment, ev.state?.segment ?? '');
  const style = asString(row.style, ev.state?.style ?? '');

  if (month === undefined || !decision || !segment || !style) {
    return null;
  }

  const features = Array.isArray(row.features) ? row.features : (ev.state?.features ?? []);
  const vd = typeof row.vd === 'number' ? Math.trunc(row.vd) : (ev.state?.vd ?? 0);
  const ret = typeof row.ret === 'number' ? Math.trunc(row.ret) : (ev.state?.ret ?? 0);
  const sat = typeof row.sat === 'number' ? Math.trunc(row.sat) : (ev.state?.sat ?? 50);
  const cash = typeof row.cash === 'number' ? Math.trunc(row.cash) : (ev.state?.cash ?? 0);
  const cost = asNumber(payload.cost, 0);
  const interviewSpend = asNumber(payload.interviewSpend, 0);
  const durationMs = typeof ev.durationMs === 'number' && Number.isFinite(ev.durationMs)
    ? Math.trunc(ev.durationMs)
    : null;

  return {
    month,
    decision,
    segment,
    featuresJson: JSON.stringify(features),
    style,
    vd,
    ret,
    sat,
    cash,
    cost,
    interviewSpend,
    durationMs,
  };
}

export function ingestBatch(
  db: DatabaseSync,
  batch: TelemetryBatch,
  meta: IngestMeta,
): IngestResult {
  return withTransaction(db, () => {
    const events = batch.events;
    let minTs = meta.receivedAt;
    let maxTs = meta.receivedAt;
    const runMinTs = new Map<string, number>();

    if (events.length > 0) {
      minTs = events[0].ts;
      maxTs = events[0].ts;
      for (const ev of events) {
        if (ev.ts < minTs) minTs = ev.ts;
        if (ev.ts > maxTs) maxTs = ev.ts;
        const prev = runMinTs.get(ev.runId);
        if (prev === undefined || ev.ts < prev) {
          runMinTs.set(ev.runId, ev.ts);
        }
      }
    }

    const upsertSession = db.prepare(`
      INSERT INTO sessions (
        session_id, first_seen_at, last_seen_at, ip, user_agent,
        viewport_w, viewport_h, reduced_motion, referrer, locale, timezone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        last_seen_at = MAX(sessions.last_seen_at, excluded.last_seen_at),
        ip = excluded.ip,
        user_agent = excluded.user_agent,
        viewport_w = COALESCE(excluded.viewport_w, sessions.viewport_w),
        viewport_h = COALESCE(excluded.viewport_h, sessions.viewport_h),
        reduced_motion = COALESCE(excluded.reduced_motion, sessions.reduced_motion),
        referrer = COALESCE(excluded.referrer, sessions.referrer),
        locale = COALESCE(excluded.locale, sessions.locale),
        timezone = COALESCE(excluded.timezone, sessions.timezone)
    `);

    const m = batch.meta;
    upsertSession.run(
      batch.sessionId,
      minTs,
      maxTs,
      meta.ip,
      meta.userAgent,
      m?.viewportW ?? null,
      m?.viewportH ?? null,
      m?.reducedMotion !== undefined ? (m.reducedMotion ? 1 : 0) : null,
      m?.referrer ?? null,
      m?.locale ?? null,
      m?.timezone ?? null,
    );

    const insertRunIgnore = db.prepare(`
      INSERT OR IGNORE INTO runs (run_id, session_id, ip, started_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const [runId, ts] of runMinTs.entries()) {
      insertRunIgnore.run(runId, batch.sessionId, meta.ip, ts, ts);
    }

    const insertEvent = db.prepare(`
      INSERT OR IGNORE INTO events (
        ts, received_at, seq, session_id, run_id, ip,
        event_type, action_type, screen_from, screen_to, duration_ms,
        payload_json, state_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const updateRunWithState = db.prepare(`
      UPDATE runs SET
        event_count = event_count + 1,
        updated_at = MAX(updated_at, ?),
        product_name = CASE WHEN ? != '' THEN ? ELSE product_name END,
        product_idea = CASE WHEN ? != '' THEN ? ELSE product_idea END,
        initial_style = COALESCE(initial_style, ?),
        current_screen = ?,
        ended_reason = COALESCE(?, ended_reason),
        ended_at = CASE WHEN ? IS NOT NULL THEN COALESCE(ended_at, ?) ELSE ended_at END,
        final_month = ?,
        final_cash = ?,
        final_vd = ?,
        final_ret = ?,
        final_sat = ?,
        pivots = ?,
        interviews = ?,
        score = COALESCE(?, score)
      WHERE run_id = ?
    `);

    const updateRunNoState = db.prepare(`
      UPDATE runs SET
        event_count = event_count + 1,
        updated_at = MAX(updated_at, ?),
        current_screen = COALESCE(?, current_screen)
      WHERE run_id = ?
    `);

    const updateRunCountOnly = db.prepare(`
      UPDATE runs SET
        event_count = event_count + 1,
        updated_at = MAX(updated_at, ?)
      WHERE run_id = ?
    `);

    const insertMonth = db.prepare(`
      INSERT OR IGNORE INTO run_months (
        run_id, month, ts, decision, segment, features_json, style,
        vd, ret, sat, cash, cost, interview_spend, duration_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertError = db.prepare(`
      INSERT INTO client_errors (
        ts, session_id, run_id, ip, screen, message, stack, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;

    for (const ev of events) {
      const res = insertEvent.run(
        ev.ts,
        meta.receivedAt,
        ev.seq,
        ev.sessionId,
        ev.runId,
        meta.ip,
        ev.eventType,
        ev.actionType ?? null,
        ev.screenFrom ?? null,
        ev.screenTo ?? null,
        ev.durationMs ?? null,
        ev.payload ? JSON.stringify(ev.payload) : null,
        ev.state ? JSON.stringify(ev.state) : null,
      );

      if (Number(res.changes) <= 0) {
        continue;
      }

      inserted += 1;

      if (ev.actionType === 'restart') {
        updateRunCountOnly.run(ev.ts, ev.runId);
      } else if (ev.state) {
        const s = ev.state;
        const endedReason = s.ended ?? null;
        let winScore: number | null = null;
        if (s.ended === 'win') {
          winScore = typeof ev.payload?.score === 'number' && Number.isFinite(ev.payload.score)
            ? Math.trunc(ev.payload.score)
            : s.cash + 2000 * (12 - s.month);
        }

        updateRunWithState.run(
          ev.ts,
          s.name,
          s.name,
          s.idea,
          s.idea,
          s.style || null,
          s.screen,
          endedReason,
          endedReason,
          ev.ts,
          s.month,
          s.cash,
          s.vd,
          s.ret,
          s.sat,
          s.pivots,
          s.interviews,
          winScore,
          ev.runId,
        );
      } else {
        updateRunNoState.run(ev.ts, ev.screenTo ?? null, ev.runId);
      }

      if (ev.eventType === 'month.simulated') {
        const row = extractMonthRow(ev);
        if (row) {
          insertMonth.run(
            ev.runId,
            row.month,
            ev.ts,
            row.decision,
            row.segment,
            row.featuresJson,
            row.style,
            row.vd,
            row.ret,
            row.sat,
            row.cash,
            row.cost,
            row.interviewSpend,
            row.durationMs,
          );
        }
      } else if (ev.eventType === 'client.error') {
        const p = ev.payload ?? {};
        insertError.run(
          ev.ts,
          ev.sessionId,
          ev.runId,
          meta.ip,
          ev.state?.screen ?? ev.screenFrom ?? null,
          asString(p.message, 'Unknown client error'),
          typeof p.stack === 'string' ? p.stack : null,
          typeof p.source === 'string' ? p.source : null,
        );
      }
    }

    return { accepted: events.length, inserted };
  });
}

function buildTimeFilter(column: string, opts?: TimeRangeOpts): { sql: string; params: SQLInputValue[] } {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];
  if (opts?.from !== undefined) {
    clauses.push(`${column} >= ?`);
    params.push(opts.from);
  }
  if (opts?.to !== undefined) {
    clauses.push(`${column} <= ?`);
    params.push(opts.to);
  }
  return {
    sql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

export function getOverview(db: DatabaseSync, opts?: TimeRangeOpts) {
  const runFilter = buildTimeFilter('started_at', opts);
  const sessionFilter = buildTimeFilter('first_seen_at', opts);

  const sessionCount = db
    .prepare(`SELECT COUNT(*) AS count FROM sessions ${sessionFilter.sql}`)
    .get(...sessionFilter.params) as { count: number };

  const runTotals = db
    .prepare(`
      SELECT
        COUNT(*) AS runs,
        COUNT(DISTINCT ip) AS uniqueIps,
        SUM(CASE WHEN ended_reason = 'win' THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN ended_reason = 'broke' THEN 1 ELSE 0 END) AS broke,
        SUM(CASE WHEN ended_reason = 'time' THEN 1 ELSE 0 END) AS timeOut,
        SUM(CASE WHEN ended_reason IS NULL THEN 1 ELSE 0 END) AS abandoned
      FROM runs
      ${runFilter.sql}
    `)
    .get(...runFilter.params) as {
      runs: number;
      uniqueIps: number;
      wins: number | null;
      broke: number | null;
      timeOut: number | null;
      abandoned: number | null;
    };

  const dropoffWhere = runFilter.sql
    ? `${runFilter.sql} AND ended_reason IS NULL`
    : 'WHERE ended_reason IS NULL';

  const screenDropoff = db
    .prepare(`
      SELECT current_screen AS screen, COUNT(*) AS count
      FROM runs
      ${dropoffWhere}
      GROUP BY current_screen
      ORDER BY count DESC
    `)
    .all(...runFilter.params) as Array<{ screen: string; count: number }>;

  const segmentStats = db
    .prepare(`
      WITH latest_month AS (
        SELECT rm.run_id, rm.segment, rm.month
        FROM run_months rm
        INNER JOIN (
          SELECT run_id, MAX(month) AS max_month
          FROM run_months
          GROUP BY run_id
        ) lm ON lm.run_id = rm.run_id AND lm.max_month = rm.month
      )
      SELECT
        lm.segment AS segment,
        COUNT(*) AS runs,
        SUM(CASE WHEN r.ended_reason = 'win' THEN 1 ELSE 0 END) AS wins,
        ROUND(AVG(r.final_cash), 0) AS avgFinalCash,
        ROUND(AVG(r.final_month), 2) AS avgMonths
      FROM runs r
      INNER JOIN latest_month lm ON lm.run_id = r.run_id
      ${runFilter.sql ? runFilter.sql.replace(/started_at/g, 'r.started_at') : ''}
      GROUP BY lm.segment
      ORDER BY runs DESC
    `)
    .all(...runFilter.params) as Array<{
      segment: string;
      runs: number;
      wins: number;
      avgFinalCash: number;
      avgMonths: number;
    }>;

  const topIps = db
    .prepare(`
      SELECT
        ip,
        COUNT(DISTINCT session_id) AS sessions,
        COUNT(*) AS runs,
        MAX(updated_at) AS lastSeenAt
      FROM runs
      ${runFilter.sql}
      GROUP BY ip
      ORDER BY runs DESC, lastSeenAt DESC
      LIMIT 20
    `)
    .all(...runFilter.params) as Array<{
      ip: string;
      sessions: number;
      runs: number;
      lastSeenAt: number;
    }>;

  return {
    sessions: Number(sessionCount.count),
    runs: Number(runTotals.runs),
    uniqueIps: Number(runTotals.uniqueIps),
    outcomes: {
      win: Number(runTotals.wins ?? 0),
      broke: Number(runTotals.broke ?? 0),
      time: Number(runTotals.timeOut ?? 0),
      abandoned: Number(runTotals.abandoned ?? 0),
    },
    screenDropoff,
    segmentStats: segmentStats.map((row) => ({
      ...row,
      winRate: row.runs > 0 ? Number((row.wins / row.runs).toFixed(4)) : 0,
    })),
    topIps,
  };
}

export function listRuns(db: DatabaseSync, opts: RunListOpts = {}) {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];

  if (opts.abandonedOnly || opts.outcome === 'abandoned') {
    clauses.push('r.ended_reason IS NULL');
  } else if (opts.outcome) {
    clauses.push('r.ended_reason = ?');
    params.push(opts.outcome);
  }

  if (opts.ip) {
    clauses.push('r.ip = ?');
    params.push(opts.ip);
  }

  if (opts.segment) {
    clauses.push('EXISTS (SELECT 1 FROM run_months rm WHERE rm.run_id = r.run_id AND rm.segment = ?)');
    params.push(opts.segment);
  }

  if (opts.q) {
    const pattern = `%${opts.q}%`;
    clauses.push('(r.product_name LIKE ? OR r.product_idea LIKE ? OR r.run_id LIKE ? OR r.session_id LIKE ? OR r.ip LIKE ?)');
    params.push(pattern, pattern, pattern, pattern, pattern);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const offset = Math.max(opts.offset ?? 0, 0);

  const countRow = db
    .prepare(`SELECT COUNT(*) AS total FROM runs r ${whereSql}`)
    .get(...params) as { total: number };

  const runs = db
    .prepare(`
      SELECT
        r.*,
        (
          SELECT rm.segment
          FROM run_months rm
          WHERE rm.run_id = r.run_id
          ORDER BY rm.month DESC
          LIMIT 1
        ) AS last_segment
      FROM runs r
      ${whereSql}
      ORDER BY r.updated_at DESC
      LIMIT ? OFFSET ?
    `)
    .all(...params, limit, offset);

  return {
    total: Number(countRow.total),
    limit,
    offset,
    runs,
  };
}

export function getRunTimeline(db: DatabaseSync, runId: string) {
  const run = db.prepare('SELECT * FROM runs WHERE run_id = ?').get(runId);
  if (!run) return null;

  const months = db
    .prepare('SELECT * FROM run_months WHERE run_id = ? ORDER BY month ASC')
    .all(runId);

  const events = db
    .prepare('SELECT * FROM events WHERE run_id = ? ORDER BY seq ASC')
    .all(runId);

  return { run, months, events };
}

interface BalanceAccumulator {
  runs: number;
  wins: number;
  sumVd: number;
  sumRet: number;
  sumSat: number;
  sumCash: number;
  sumMonths: number;
}

function finalizeBalance(acc: BalanceAccumulator) {
  const n = acc.runs || 1;
  return {
    runs: acc.runs,
    wins: acc.wins,
    winRate: acc.runs > 0 ? Number((acc.wins / acc.runs).toFixed(4)) : 0,
    avgVd: Number((acc.sumVd / n).toFixed(2)),
    avgRet: Number((acc.sumRet / n).toFixed(2)),
    avgSat: Number((acc.sumSat / n).toFixed(2)),
    avgCash: Math.round(acc.sumCash / n),
    avgMonths: Number((acc.sumMonths / n).toFixed(2)),
  };
}

function accumulate(map: Map<string, BalanceAccumulator>, key: string, row: {
  ended_reason: string | null;
  final_vd: number;
  final_ret: number;
  final_sat: number;
  final_cash: number;
  final_month: number;
}) {
  let acc = map.get(key);
  if (!acc) {
    acc = { runs: 0, wins: 0, sumVd: 0, sumRet: 0, sumSat: 0, sumCash: 0, sumMonths: 0 };
    map.set(key, acc);
  }
  acc.runs += 1;
  if (row.ended_reason === 'win') acc.wins += 1;
  acc.sumVd += row.final_vd;
  acc.sumRet += row.final_ret;
  acc.sumSat += row.final_sat;
  acc.sumCash += row.final_cash;
  acc.sumMonths += row.final_month;
}

export function getGameplayBalance(db: DatabaseSync, opts?: TimeRangeOpts) {
  const runFilter = buildTimeFilter('r.started_at', opts);

  const runRows = db
    .prepare(`
      SELECT
        r.run_id,
        r.ended_reason,
        r.final_vd,
        r.final_ret,
        r.final_sat,
        r.final_cash,
        r.final_month,
        r.pivots,
        r.interviews,
        lm.segment AS last_segment,
        lm.style AS last_style,
        lm.features_json AS last_features_json
      FROM runs r
      LEFT JOIN (
        SELECT rm.run_id, rm.segment, rm.style, rm.features_json
        FROM run_months rm
        INNER JOIN (
          SELECT run_id, MAX(month) AS max_month
          FROM run_months
          GROUP BY run_id
        ) m ON m.run_id = rm.run_id AND m.max_month = rm.month
      ) lm ON lm.run_id = r.run_id
      ${runFilter.sql}
    `)
    .all(...runFilter.params) as Array<{
      run_id: string;
      ended_reason: string | null;
      final_vd: number;
      final_ret: number;
      final_sat: number;
      final_cash: number;
      final_month: number;
      pivots: number;
      interviews: number;
      last_segment: string | null;
      last_style: string | null;
      last_features_json: string | null;
    }>;

  const segMap = new Map<string, BalanceAccumulator>();
  const featMap = new Map<string, BalanceAccumulator>();
  const styleMap = new Map<string, BalanceAccumulator>();
  const pivotMap = new Map<string, BalanceAccumulator>();
  const interviewMap = new Map<string, BalanceAccumulator>();

  for (const r of runRows) {
    if (r.last_segment) accumulate(segMap, r.last_segment, r);
    if (r.last_style) accumulate(styleMap, r.last_style, r);
    accumulate(pivotMap, String(r.pivots), r);
    accumulate(interviewMap, String(r.interviews), r);

    if (r.last_features_json) {
      try {
        const feats = JSON.parse(r.last_features_json) as unknown;
        if (Array.isArray(feats)) {
          for (const f of feats) {
            if (typeof f === 'string') {
              accumulate(featMap, f, r);
            }
          }
        }
      } catch {
        // Ignore malformed JSON
      }
    }
  }

  return {
    bySegment: Array.from(segMap.entries()).map(([segment, acc]) => ({ segment, ...finalizeBalance(acc) })),
    byFeature: Array.from(featMap.entries()).map(([feature, acc]) => ({ feature, ...finalizeBalance(acc) })),
    byStyle: Array.from(styleMap.entries()).map(([style, acc]) => ({ style, ...finalizeBalance(acc) })),
    byPivots: Array.from(pivotMap.entries())
      .map(([pivots, acc]) => ({ pivots: Number(pivots), ...finalizeBalance(acc) }))
      .sort((a, b) => a.pivots - b.pivots),
    byInterviews: Array.from(interviewMap.entries())
      .map(([interviews, acc]) => ({ interviews: Number(interviews), ...finalizeBalance(acc) }))
      .sort((a, b) => a.interviews - b.interviews),
  };
}

export function getFrictionSignals(db: DatabaseSync, opts?: TimeRangeOpts) {
  const timeFilter = buildTimeFilter('ts', opts);
  const wherePrefix = timeFilter.sql ? `${timeFilter.sql} AND` : 'WHERE';

  const disabledClicks = db
    .prepare(`
      SELECT
        screen_from AS screen,
        COALESCE(action_type, json_extract(payload_json, '$.action')) AS actionType,
        COUNT(*) AS count
      FROM events
      ${wherePrefix} event_type = 'ui.disabled_click'
      GROUP BY screen_from, COALESCE(action_type, json_extract(payload_json, '$.action'))
      ORDER BY count DESC
    `)
    .all(...timeFilter.params) as Array<{ screen: string | null; actionType: string | null; count: number }>;

  const modalCancellations = db
    .prepare(`
      SELECT
        screen_from AS screen,
        COALESCE(action_type, json_extract(payload_json, '$.modalType')) AS actionType,
        COUNT(*) AS count
      FROM events
      ${wherePrefix} event_type = 'ui.modal_cancelled'
      GROUP BY screen_from, COALESCE(action_type, json_extract(payload_json, '$.modalType'))
      ORDER BY count DESC
    `)
    .all(...timeFilter.params) as Array<{ screen: string | null; actionType: string | null; count: number }>;

  const setupErrorRow = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM events
      ${wherePrefix} (
        (state_json IS NOT NULL AND json_extract(state_json, '$.setupError') IS NOT NULL AND json_extract(state_json, '$.setupError') != '')
        OR (payload_json IS NOT NULL AND json_extract(payload_json, '$.setupError') IS NOT NULL AND json_extract(payload_json, '$.setupError') != '')
      )
    `)
    .get(...timeFilter.params) as { count: number };

  const pickLimitRow = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM events
      ${wherePrefix} (
        (event_type = 'action.dispatched' AND action_type = 'feat' AND payload_json IS NOT NULL AND json_extract(payload_json, '$.pickLimitHit') = 1)
        OR (event_type = 'ui.disabled_click' AND (action_type LIKE '%pick%' OR (payload_json IS NOT NULL AND json_extract(payload_json, '$.reason') = 'pick_limit')))
      )
    `)
    .get(...timeFilter.params) as { count: number };

  const screenDwellMs = db
    .prepare(`
      SELECT
        screen_from AS screen,
        COUNT(*) AS count,
        ROUND(AVG(duration_ms), 0) AS avgMs,
        SUM(duration_ms) AS totalMs
      FROM events
      ${wherePrefix} duration_ms IS NOT NULL
        AND screen_from IS NOT NULL
        AND screen_from != 'testing'
      GROUP BY screen_from
      ORDER BY avgMs DESC
    `)
    .all(...timeFilter.params) as Array<{
      screen: string;
      count: number;
      avgMs: number;
      totalMs: number;
    }>;

  return {
    disabledClicks: {
      total: disabledClicks.reduce((sum, r) => sum + Number(r.count), 0),
      breakdown: disabledClicks,
    },
    modalCancellations: {
      total: modalCancellations.reduce((sum, r) => sum + Number(r.count), 0),
      breakdown: modalCancellations,
    },
    setupErrors: Number(setupErrorRow.count),
    pickLimitHits: Number(pickLimitRow.count),
    screenDwellMs,
  };
}

export function queryEvents(db: DatabaseSync, opts: EventQueryOpts = {}) {
  const clauses: string[] = [];
  const params: SQLInputValue[] = [];

  if (opts.runId) {
    clauses.push('run_id = ?');
    params.push(opts.runId);
  }
  if (opts.sessionId) {
    clauses.push('session_id = ?');
    params.push(opts.sessionId);
  }
  if (opts.ip) {
    clauses.push('ip = ?');
    params.push(opts.ip);
  }
  if (opts.eventType) {
    clauses.push('event_type = ?');
    params.push(opts.eventType);
  }
  if (opts.actionType) {
    clauses.push('action_type = ?');
    params.push(opts.actionType);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);

  return db
    .prepare(`
      SELECT * FROM events
      ${whereSql}
      ORDER BY ts DESC, id DESC
      LIMIT ?
    `)
    .all(...params, limit);
}

export function listClientErrors(db: DatabaseSync, limit = 100) {
  const safeLimit = Math.min(Math.max(limit, 1), 500);
  return db
    .prepare('SELECT * FROM client_errors ORDER BY ts DESC, id DESC LIMIT ?')
    .all(safeLimit);
}

export function deleteRun(db: DatabaseSync, runId: string): boolean {
  return withTransaction(db, () => {
    db.prepare('DELETE FROM client_errors WHERE run_id = ?').run(runId);
    db.prepare('DELETE FROM events WHERE run_id = ?').run(runId);
    db.prepare('DELETE FROM run_months WHERE run_id = ?').run(runId);
    const res = db.prepare('DELETE FROM runs WHERE run_id = ?').run(runId);
    return Number(res.changes) > 0;
  });
}

export function pruneData(db: DatabaseSync, opts: PruneOpts): PruneResult {
  if (!opts.ip && opts.olderThanMs === undefined) {
    return { deletedRuns: 0, deletedSessions: 0, deletedEvents: 0, deletedErrors: 0 };
  }

  return withTransaction(db, () => {
    const runClauses: string[] = [];
    const runParams: SQLInputValue[] = [];
    if (opts.ip) {
      runClauses.push('ip = ?');
      runParams.push(opts.ip);
    }
    if (opts.olderThanMs !== undefined) {
      runClauses.push('updated_at < ?');
      runParams.push(opts.olderThanMs);
    }
    const runWhere = runClauses.join(' AND ');

    const errClauses: string[] = [];
    const errParams: SQLInputValue[] = [];
    if (opts.ip) {
      errClauses.push('ip = ?');
      errParams.push(opts.ip);
    }
    if (opts.olderThanMs !== undefined) {
      errClauses.push('ts < ?');
      errParams.push(opts.olderThanMs);
    }

    const errRes = db
      .prepare(`DELETE FROM client_errors WHERE ${errClauses.join(' AND ')} OR run_id IN (SELECT run_id FROM runs WHERE ${runWhere})`)
      .run(...errParams, ...runParams);

    const evRes = db
      .prepare(`DELETE FROM events WHERE run_id IN (SELECT run_id FROM runs WHERE ${runWhere})`)
      .run(...runParams);

    db.prepare(`DELETE FROM run_months WHERE run_id IN (SELECT run_id FROM runs WHERE ${runWhere})`)
      .run(...runParams);

    const runsRes = db
      .prepare(`DELETE FROM runs WHERE ${runWhere}`)
      .run(...runParams);

    const sessClauses: string[] = [];
    const sessParams: SQLInputValue[] = [];
    if (opts.ip) {
      sessClauses.push('ip = ?');
      sessParams.push(opts.ip);
    }
    if (opts.olderThanMs !== undefined) {
      sessClauses.push('last_seen_at < ?');
      sessParams.push(opts.olderThanMs);
    }
    const sessRes = db
      .prepare(`
        DELETE FROM sessions
        WHERE ${sessClauses.join(' AND ')}
          AND NOT EXISTS (SELECT 1 FROM runs WHERE runs.session_id = sessions.session_id)
      `)
      .run(...sessParams);

    return {
      deletedRuns: Number(runsRes.changes),
      deletedSessions: Number(sessRes.changes),
      deletedEvents: Number(evRes.changes),
      deletedErrors: Number(errRes.changes),
    };
  });
}
