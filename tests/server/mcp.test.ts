import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ingestBatch, openDatabase } from '../../server/db.js';
import { createAppServer } from '../../server/index.js';
import type { StateSummary } from '../../src/shared/telemetry.js';

function makeState(overrides: Partial<StateSummary> = {}): StateSummary {
  return {
    screen: 'setup',
    month: 0,
    cash: 100000,
    name: 'McpApp',
    idea: 'MCP test idea',
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

interface JsonRpcResponse {
  jsonrpc: string;
  id?: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
}

async function parseMcpResponse(res: Response): Promise<JsonRpcResponse> {
  const ct = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (ct.includes('text/event-stream')) {
    const dataLines = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter((line) => line.length > 0);
    const last = dataLines[dataLines.length - 1];
    if (!last) {
      throw new Error(`Empty SSE response: ${text}`);
    }
    return JSON.parse(last) as JsonRpcResponse;
  }
  return JSON.parse(text) as JsonRpcResponse;
}

async function mcpCall(
  baseUrl: string,
  authHeader: string,
  method: string,
  params: Record<string, unknown>,
  id: number,
): Promise<JsonRpcResponse> {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      authorization: authHeader,
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params,
    }),
  });
  expect(res.status).toBe(200);
  return parseMcpResponse(res);
}

describe('MCP HTTP endpoint', () => {
  let baseUrl: string;
  let distDir: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    distDir = mkdtempSync(path.join(tmpdir(), 'fop-mcp-dist-'));
    writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><html></html>');

    const db = openDatabase(':memory:');
    ingestBatch(
      db,
      {
        sessionId: 'mcp-sess-1',
        events: [
          {
            seq: 1,
            ts: 1000,
            sessionId: 'mcp-sess-1',
            runId: 'mcp-run-1',
            eventType: 'month.simulated',
            screenFrom: 'build',
            screenTo: 'result',
            durationMs: 1200,
            payload: {
              row: {
                month: 1,
                vd: 42,
                ret: 33,
                sat: 75,
                cash: 90000,
                decision: 'Launch MVP',
                segment: 'teams',
                features: ['team', 'stats'],
                style: 'professional',
              },
              cost: 10000,
              interviewSpend: 0,
            },
            state: makeState({
              screen: 'end',
              month: 1,
              cash: 90000,
              segment: 'teams',
              features: ['team', 'stats'],
              style: 'professional',
              vd: 42,
              ret: 33,
              sat: 75,
              ended: 'win',
              lastDecision: 'Launch MVP',
            }),
          },
          {
            seq: 2,
            ts: 2000,
            sessionId: 'mcp-sess-1',
            runId: 'mcp-run-1',
            eventType: 'client.error',
            screenFrom: 'end',
            payload: { message: 'Sample error', source: 'test' },
          },
        ],
      },
      { ip: '198.51.100.7', userAgent: 'vitest', receivedAt: 2001 },
    );

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

  it('enforces auth on /mcp (Bearer & Basic) and returns 405 on GET /mcp', async () => {
    const unauth = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    expect(unauth.status).toBe(401);

    const getRes = await fetch(`${baseUrl}/mcp`, {
      method: 'GET',
      headers: { authorization: 'Bearer admin' },
    });
    expect(getRes.status).toBe(405);
    expect(getRes.headers.get('allow')).toBe('POST');

    const basicHeader = `Basic ${Buffer.from('mcp:admin').toString('base64')}`;
    const initBasic = await mcpCall(
      baseUrl,
      basicHeader,
      'initialize',
      {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'vitest', version: '1.0.0' },
      },
      1,
    );
    expect(initBasic.result?.serverInfo).toBeDefined();
  });

  it('supports initialize, tools/list, all 7 telemetry tools, and resources/read', async () => {
    const bearer = 'Bearer admin';

    const init = await mcpCall(
      baseUrl,
      bearer,
      'initialize',
      {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'vitest', version: '1.0.0' },
      },
      1,
    );
    expect(init.result?.protocolVersion).toBeDefined();

    const toolsList = await mcpCall(baseUrl, bearer, 'tools/list', {}, 2);
    const tools = (toolsList.result?.tools ?? []) as Array<{ name: string }>;
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toEqual(
      expect.arrayContaining([
        'get_overview_metrics',
        'list_runs',
        'get_run_timeline',
        'get_friction_signals',
        'get_gameplay_balance',
        'query_events',
        'list_client_errors',
      ]),
    );

    const toolCalls: Array<[string, Record<string, unknown>]> = [
      ['get_overview_metrics', {}],
      ['list_runs', { outcome: 'win' }],
      ['get_run_timeline', { runId: 'mcp-run-1' }],
      ['get_friction_signals', {}],
      ['get_gameplay_balance', {}],
      ['query_events', { runId: 'mcp-run-1' }],
      ['list_client_errors', { limit: 10 }],
    ];

    let reqId = 10;
    for (const [name, args] of toolCalls) {
      const res = await mcpCall(baseUrl, bearer, 'tools/call', { name, arguments: args }, reqId++);
      expect(res.error).toBeUndefined();
      const content = (res.result?.content ?? []) as Array<{ type: string; text: string }>;
      expect(content[0]?.type).toBe('text');
      expect(() => JSON.parse(content[0].text)).not.toThrow();
    }

    const resourceRes = await mcpCall(
      baseUrl,
      bearer,
      'resources/read',
      { uri: 'fit-or-pivot://schema/telemetry' },
      100,
    );
    const contents = (resourceRes.result?.contents ?? []) as Array<{ text: string }>;
    expect(contents[0]?.text).toContain('VD_TARGET = 40');
  });
});
