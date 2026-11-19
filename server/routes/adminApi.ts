import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { requireAdminAuth, requireSameOriginOrAjax } from '../auth.js';
import {
  deleteRun,
  getFrictionSignals,
  getGameplayBalance,
  getOverview,
  getRunTimeline,
  listClientErrors,
  listRuns,
  pruneData,
  queryEvents,
} from '../db.js';
import { HttpError, readJsonBody, sendJson, sendText } from '../http.js';

const NO_STORE_HEADERS: Record<string, string> = {
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
};

function parseOptionalInt(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

function parseOptionalString(raw: string | null): string | undefined {
  if (raw === null) return undefined;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function escapeCsvCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map((h) => escapeCsvCell(h)).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => escapeCsvCell(row[h])).join(','));
  }
  return lines.join('\r\n');
}

export async function handleAdminApi(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  db: DatabaseSync,
): Promise<boolean> {
  const { pathname, searchParams } = url;
  if (pathname !== '/api/admin' && !pathname.startsWith('/api/admin/')) {
    return false;
  }

  if (!requireAdminAuth(req, res)) {
    return true;
  }

  const method = (req.method ?? 'GET').toUpperCase();

  try {
    if (method === 'GET' && pathname === '/api/admin/overview') {
      const from = parseOptionalInt(searchParams.get('from'));
      const to = parseOptionalInt(searchParams.get('to'));
      sendJson(res, 200, getOverview(db, { from, to }), NO_STORE_HEADERS);
      return true;
    }

    if (method === 'GET' && pathname === '/api/admin/runs') {
      const abandonedRaw = searchParams.get('abandonedOnly');
      const abandonedOnly = abandonedRaw === 'true' || abandonedRaw === '1';
      const result = listRuns(db, {
        outcome: parseOptionalString(searchParams.get('outcome')),
        segment: parseOptionalString(searchParams.get('segment')),
        ip: parseOptionalString(searchParams.get('ip')),
        q: parseOptionalString(searchParams.get('q')),
        abandonedOnly,
        limit: parseOptionalInt(searchParams.get('limit')),
        offset: parseOptionalInt(searchParams.get('offset')),
      });
      sendJson(res, 200, result, NO_STORE_HEADERS);
      return true;
    }

    if (pathname.startsWith('/api/admin/runs/')) {
      const encodedId = pathname.slice('/api/admin/runs/'.length);
      if (!encodedId || encodedId.includes('/')) {
        sendJson(res, 404, { error: 'Not found' }, NO_STORE_HEADERS);
        return true;
      }

      let runId: string;
      try {
        runId = decodeURIComponent(encodedId);
      } catch {
        sendJson(res, 400, { error: 'Invalid runId encoding' }, NO_STORE_HEADERS);
        return true;
      }

      if (method === 'GET') {
        const timeline = getRunTimeline(db, runId);
        if (!timeline) {
          sendJson(res, 404, { error: 'Run not found' }, NO_STORE_HEADERS);
          return true;
        }
        sendJson(res, 200, timeline, NO_STORE_HEADERS);
        return true;
      }

      if (method === 'DELETE') {
        if (!requireSameOriginOrAjax(req, res)) return true;
        const deleted = deleteRun(db, runId);
        if (!deleted) {
          sendJson(res, 404, { error: 'Run not found' }, NO_STORE_HEADERS);
          return true;
        }
        sendJson(res, 200, { deleted: true, runId }, NO_STORE_HEADERS);
        return true;
      }
    }

    if (method === 'GET' && pathname === '/api/admin/friction') {
      const from = parseOptionalInt(searchParams.get('from'));
      const to = parseOptionalInt(searchParams.get('to'));
      sendJson(res, 200, getFrictionSignals(db, { from, to }), NO_STORE_HEADERS);
      return true;
    }

    if (method === 'GET' && pathname === '/api/admin/balance') {
      const from = parseOptionalInt(searchParams.get('from'));
      const to = parseOptionalInt(searchParams.get('to'));
      sendJson(res, 200, getGameplayBalance(db, { from, to }), NO_STORE_HEADERS);
      return true;
    }

    if (method === 'GET' && pathname === '/api/admin/events') {
      const events = queryEvents(db, {
        runId: parseOptionalString(searchParams.get('runId')),
        sessionId: parseOptionalString(searchParams.get('sessionId')),
        ip: parseOptionalString(searchParams.get('ip')),
        eventType: parseOptionalString(searchParams.get('eventType')),
        actionType: parseOptionalString(searchParams.get('actionType')),
        limit: parseOptionalInt(searchParams.get('limit')),
      });
      sendJson(res, 200, { events }, NO_STORE_HEADERS);
      return true;
    }

    if (method === 'GET' && pathname === '/api/admin/errors') {
      const limit = parseOptionalInt(searchParams.get('limit'));
      const errors = listClientErrors(db, limit);
      sendJson(res, 200, { errors }, NO_STORE_HEADERS);
      return true;
    }

    if (method === 'GET' && pathname === '/api/admin/export') {
      const format = (searchParams.get('format') ?? 'json').toLowerCase();
      const type = (searchParams.get('type') ?? 'runs').toLowerCase();

      if (format !== 'json' && format !== 'csv') {
        sendJson(res, 400, { error: 'Invalid format; expected json or csv' }, NO_STORE_HEADERS);
        return true;
      }
      if (type !== 'runs' && type !== 'events') {
        sendJson(res, 400, { error: 'Invalid type; expected runs or events' }, NO_STORE_HEADERS);
        return true;
      }

      const rows = (
        type === 'runs'
          ? db.prepare('SELECT * FROM runs ORDER BY updated_at DESC LIMIT 10000').all()
          : db.prepare('SELECT * FROM events ORDER BY ts DESC, id DESC LIMIT 50000').all()
      ) as Array<Record<string, unknown>>;

      const headers = {
        ...NO_STORE_HEADERS,
        'content-disposition': `attachment; filename="fit-or-pivot-${type}.${format}"`,
      };

      if (format === 'csv') {
        sendText(res, 200, toCsv(rows), 'text/csv; charset=utf-8', headers);
      } else {
        sendJson(res, 200, rows, headers);
      }
      return true;
    }

    if (method === 'POST' && pathname === '/api/admin/prune') {
      if (!requireSameOriginOrAjax(req, res)) return true;

      const body = await readJsonBody(req);
      if (typeof body !== 'object' || body === null || Array.isArray(body)) {
        sendJson(res, 400, { error: 'Request body must be a JSON object' }, NO_STORE_HEADERS);
        return true;
      }

      const rawIp = (body as Record<string, unknown>).ip;
      const rawDays = (body as Record<string, unknown>).olderThanDays;

      const ip = typeof rawIp === 'string' && rawIp.trim().length > 0 ? rawIp.trim() : undefined;
      if (rawIp !== undefined && rawIp !== null && typeof rawIp !== 'string') {
        sendJson(res, 400, { error: 'ip must be a string' }, NO_STORE_HEADERS);
        return true;
      }

      let olderThanMs: number | undefined;
      if (rawDays !== undefined && rawDays !== null && rawDays !== '') {
        const days = typeof rawDays === 'number' ? rawDays : Number(rawDays);
        if (!Number.isFinite(days) || days < 0) {
          sendJson(res, 400, { error: 'olderThanDays must be a non-negative number' }, NO_STORE_HEADERS);
          return true;
        }
        olderThanMs = Date.now() - Math.round(days * 86_400_000);
      }

      if (!ip && olderThanMs === undefined) {
        sendJson(res, 400, { error: 'Provide ip or olderThanDays' }, NO_STORE_HEADERS);
        return true;
      }

      const result = pruneData(db, { ip, olderThanMs });
      sendJson(res, 200, result, NO_STORE_HEADERS);
      return true;
    }

    sendJson(res, 404, { error: 'Not found' }, NO_STORE_HEADERS);
    return true;
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { error: err.message }, NO_STORE_HEADERS);
      return true;
    }
    console.error('[adminApi] unexpected error:', err);
    sendJson(res, 500, { error: 'Internal server error' }, NO_STORE_HEADERS);
    return true;
  }
}
