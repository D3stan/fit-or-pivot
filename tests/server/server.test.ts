import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../../server/db.js';
import { createAppServer } from '../../server/index.js';
import type { StateSummary, TelemetryBatch } from '../../src/shared/telemetry.js';

function makeState(overrides: Partial<StateSummary> = {}): StateSummary {
  return {
    screen: 'setup',
    month: 0,
    cash: 100000,
    name: 'TestApp',
    idea: 'Test Idea',
    style: 'minimal',
    segment: null,
    features: [],
    sat: 50,
    ret: 0,
    vd: 0,
    streak: 0,
    pivots: 0,
    interviews: 0,
    modalType: null,
    ended: null,
    lastDecision: '',
    pick: [],
    setupError: '',
    ...overrides,
  };
}

function basicAuthHeader(password = 'admin', user = 'admin'): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString('base64')}`;
}

describe('server HTTP & admin integration', () => {
  let baseUrl: string;
  let distDir: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    distDir = mkdtempSync(path.join(tmpdir(), 'fop-dist-'));
    writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><html><body>Fit or Pivot</body></html>');
    writeFileSync(path.join(distDir, 'app.js'), 'console.log("ok");');

    const db = openDatabase(':memory:');
    const { server } = createAppServer({ db, distDir });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;

    cleanup = async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
      db.close();
      rmSync(distDir, { recursive: true, force: true });
    };
  });

  afterAll(async () => {
    await cleanup();
  });

  it('serves /health, static /, static assets, and 404 on unknown routes', async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });

    const root = await fetch(`${baseUrl}/`);
    expect(root.status).toBe(200);
    expect(root.headers.get('content-type')).toContain('text/html');
    expect(await root.text()).toContain('Fit or Pivot');

    const js = await fetch(`${baseUrl}/app.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get('content-type')).toContain('application/javascript');

    const missing = await fetch(`${baseUrl}/admin/typo`);
    expect(missing.status).toBe(404);
  });

  it('ingests telemetry via application/json and text/plain, extracts IP, deduplicates seq, and preserves completed runs on restart', async () => {
    const batch1: TelemetryBatch = {
      sessionId: 'sess-1',
      meta: {
        viewportW: 1280,
        viewportH: 720,
        reducedMotion: false,
        referrer: 'https://example.com',
        locale: 'en-US',
        timezone: 'UTC',
      },
      events: [
        {
          seq: 1,
          ts: 1000,
          sessionId: 'sess-1',
          runId: 'run-1',
          eventType: 'run.start',
          screenTo: 'setup',
          state: makeState({ name: '=CMD|calc', idea: 'Coffee loyalty' }),
        },
        {
          seq: 2,
          ts: 2000,
          sessionId: 'sess-1',
          runId: 'run-1',
          eventType: 'month.simulated',
          screenFrom: 'build',
          screenTo: 'result',
          durationMs: 2500,
          payload: {
            row: {
              month: 4,
              vd: 45,
              ret: 35,
              sat: 80,
              cash: 80000,
              decision: 'Persevere',
              segment: 'cafes',
              features: ['invoice', 'design'],
              style: 'minimal',
            },
            cost: 5000,
            interviewSpend: 2000,
            score: 96000,
          },
          state: makeState({
            screen: 'end',
            month: 4,
            cash: 80000,
            name: '=CMD|calc',
            idea: 'Coffee loyalty',
            segment: 'cafes',
            features: ['invoice', 'design'],
            vd: 45,
            ret: 35,
            sat: 80,
            streak: 3,
            interviews: 1,
            ended: 'win',
            lastDecision: 'Persevere',
          }),
        },
        {
          seq: 3,
          ts: 3000,
          sessionId: 'sess-1',
          runId: 'run-1',
          eventType: 'action.dispatched',
          actionType: 'restart',
          screenFrom: 'end',
          screenTo: 'intro',
          state: makeState({
            screen: 'intro',
            month: 0,
            cash: 100000,
            name: '',
            idea: '',
            ended: null,
          }),
        },
      ],
    };

    const res1 = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-real-ip': '::ffff:203.0.113.10',
      },
      body: JSON.stringify(batch1),
    });
    expect(res1.status).toBe(202);
    expect(await res1.json()).toEqual({ ok: true, accepted: 3, inserted: 3 });

    // Duplicate seq=2 should be ignored idempotently; seq=4 & 5 via text/plain sendBeacon
    const batch2: TelemetryBatch = {
      sessionId: 'sess-1',
      events: [
        batch1.events[1],
        {
          seq: 4,
          ts: 4000,
          sessionId: 'sess-1',
          runId: 'run-1',
          eventType: 'action.dispatched',
          actionType: 'feat',
          screenFrom: 'build',
          payload: { pickLimitHit: true },
        },
        {
          seq: 5,
          ts: 5000,
          sessionId: 'sess-1',
          runId: 'run-1',
          eventType: 'client.error',
          screenFrom: 'build',
          payload: { message: 'Boom', stack: 'Error: Boom', source: 'window.onerror' },
        },
      ],
    };

    const res2 = await fetch(`${baseUrl}/api/telemetry`, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        'x-forwarded-for': '198.51.100.1, 203.0.113.10',
      },
      body: JSON.stringify(batch2),
    });
    expect(res2.status).toBe(202);
    expect(await res2.json()).toEqual({ ok: true, accepted: 3, inserted: 2 });
  });

  it('protects /admin and /api/admin/* with Basic Auth and serves analytics, CSV export, and CSRF-protected mutations', async () => {
    const unauthPage = await fetch(`${baseUrl}/admin`);
    expect(unauthPage.status).toBe(401);
    expect(unauthPage.headers.get('www-authenticate')).toContain('Basic');

    const unauthApi = await fetch(`${baseUrl}/api/admin/overview`);
    expect(unauthApi.status).toBe(401);

    const authHeaders = { authorization: basicAuthHeader() };

    const adminPage = await fetch(`${baseUrl}/admin`, { headers: authHeaders });
    expect(adminPage.status).toBe(200);
    expect(adminPage.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(await adminPage.text()).toContain('Fit or Pivot');

    const overviewRes = await fetch(`${baseUrl}/api/admin/overview`, { headers: authHeaders });
    expect(overviewRes.status).toBe(200);
    const overview = (await overviewRes.json()) as {
      runs: number;
      outcomes: { win: number };
      topIps: Array<{ ip: string }>;
    };
    expect(overview.runs).toBe(1);
    expect(overview.outcomes.win).toBe(1);
    expect(overview.topIps[0]?.ip).toBe('203.0.113.10');

    const timelineRes = await fetch(`${baseUrl}/api/admin/runs/run-1`, { headers: authHeaders });
    expect(timelineRes.status).toBe(200);
    const timeline = (await timelineRes.json()) as {
      run: {
        ended_reason: string;
        final_cash: number;
        current_screen: string;
        score: number;
        event_count: number;
      };
      months: Array<{ month: number }>;
      events: Array<{ seq: number }>;
    };
    expect(timeline.run.ended_reason).toBe('win');
    expect(timeline.run.final_cash).toBe(80000);
    expect(timeline.run.current_screen).toBe('end');
    expect(timeline.run.score).toBe(96000);
    expect(timeline.run.event_count).toBe(5);
    expect(timeline.months).toHaveLength(1);
    expect(timeline.events).toHaveLength(5);

    const frictionRes = await fetch(`${baseUrl}/api/admin/friction`, { headers: authHeaders });
    expect(frictionRes.status).toBe(200);
    const friction = (await frictionRes.json()) as { pickLimitHits: number };
    expect(friction.pickLimitHits).toBe(1);

    const balanceRes = await fetch(`${baseUrl}/api/admin/balance`, { headers: authHeaders });
    expect(balanceRes.status).toBe(200);
    const balance = (await balanceRes.json()) as { bySegment: Array<{ segment: string }> };
    expect(balance.bySegment[0]?.segment).toBe('cafes');

    const errorsRes = await fetch(`${baseUrl}/api/admin/errors`, { headers: authHeaders });
    expect(errorsRes.status).toBe(200);
    const errors = (await errorsRes.json()) as { errors: Array<{ message: string }> };
    expect(errors.errors).toHaveLength(1);
    expect(errors.errors[0]?.message).toBe('Boom');

    const csvRes = await fetch(`${baseUrl}/api/admin/export?format=csv`, { headers: authHeaders });
    expect(csvRes.status).toBe(200);
    const csvText = await csvRes.text();
    expect(csvText).toContain("'=CMD|calc");

    // CSRF protection: DELETE without x-requested-with or Origin fails with 403
    const csrfBlocked = await fetch(`${baseUrl}/api/admin/runs/run-1`, {
      method: 'DELETE',
      headers: authHeaders,
    });
    expect(csrfBlocked.status).toBe(403);

    const deleteOk = await fetch(`${baseUrl}/api/admin/runs/run-1`, {
      method: 'DELETE',
      headers: { ...authHeaders, 'x-requested-with': 'fetch' },
    });
    expect(deleteOk.status).toBe(200);

    const afterDelete = await fetch(`${baseUrl}/api/admin/runs/run-1`, { headers: authHeaders });
    expect(afterDelete.status).toBe(404);

    const pruneOk = await fetch(`${baseUrl}/api/admin/prune`, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
        'x-requested-with': 'fetch',
      },
      body: JSON.stringify({ ip: '203.0.113.10' }),
    });
    expect(pruneOk.status).toBe(200);
  });
});
