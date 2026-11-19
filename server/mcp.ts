import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import {
  getFrictionSignals,
  getGameplayBalance,
  getOverview,
  getRunTimeline,
  listClientErrors,
  listRuns,
  queryEvents,
} from './db.js';
import { HttpError, readJsonBody, sendJson } from './http.js';

const MAX_MCP_BODY_BYTES = 1048576;

const TELEMETRY_SCHEMA_DOC = `# Fit or Pivot Telemetry Schema & Game Constants

## Game Balance Constants
- \`VD_TARGET = 40\` (% of users saying "very disappointed" needed for fit)
- \`RET_TARGET = 30\` (% of users still active/retained needed for fit)
- \`WIN_STREAK = 3\` (consecutive fit months required to win)
- \`MAX_MONTH = 12\` (maximum runway months before time runs out)
- \`START_CASH = 100000\` (starting cash in $)
- \`BURN = 5000\` (monthly burn in $)
- \`FEATURE_COST = 5000\`, \`ITER_COST = 4000\`, \`ADD_COST = 12000\`, \`PIVOT_COST = 20000\`, \`INTERVIEW_COST = 2000\`
- \`MVP_FEATURES = 2\`, \`MAX_FEATURES = 4\`

## SQLite Tables
1. \`sessions\`: \`session_id\` (PK), \`first_seen_at\`, \`last_seen_at\`, \`ip\`, \`user_agent\`, \`viewport_w\`, \`viewport_h\`, \`reduced_motion\`, \`referrer\`, \`locale\`, \`timezone\`
2. \`runs\`: \`run_id\` (PK), \`session_id\` (FK), \`ip\`, \`started_at\`, \`updated_at\`, \`ended_at\`, \`product_name\`, \`product_idea\`, \`initial_style\`, \`current_screen\`, \`ended_reason\` (\`win\` | \`broke\` | \`time\` | \`NULL\`), \`final_month\`, \`final_cash\`, \`final_vd\`, \`final_ret\`, \`final_sat\`, \`pivots\`, \`interviews\`, \`score\`, \`event_count\`
3. \`run_months\`: \`(run_id, month)\` (PK), \`ts\`, \`decision\`, \`segment\`, \`features_json\`, \`style\`, \`vd\`, \`ret\`, \`sat\`, \`cash\`, \`cost\`, \`interview_spend\`, \`duration_ms\`
4. \`events\`: \`id\` (PK), \`ts\`, \`received_at\`, \`seq\`, \`session_id\`, \`run_id\`, \`ip\`, \`event_type\`, \`action_type\`, \`screen_from\`, \`screen_to\`, \`duration_ms\`, \`payload_json\`, \`state_json\`
5. \`client_errors\`: \`id\` (PK), \`ts\`, \`session_id\`, \`run_id\`, \`ip\`, \`screen\`, \`message\`, \`stack\`, \`source\`

## Telemetry Event Taxonomy
- \`session.start\`: First event for a browser session with viewport/locale/referrer metadata.
- \`run.start\`: New game run started (initial or restart).
- \`action.dispatched\`: Player dispatched a game/UI action (\`actionType\` records the action).
- \`month.simulated\`: End-of-month simulation completed; populates \`run_months\` and updates \`runs\` summary.
- \`ui.disabled_click\`: Player clicked a disabled control (e.g. feature pick limit or insufficient cash).
- \`ui.modal_cancelled\`: Player dismissed a decision/help modal without confirming.
- \`ui.input_blur\`: Player blurred a setup input field.
- \`ui.backdrop_click\`: Player clicked modal backdrop.
- \`page.visibility\`: Document visibility changed (\`hidden\` / \`visible\`).
- \`client.error\`: Uncaught runtime error or unhandled promise rejection.
`;

function jsonToolResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

/**
 * Create a configured McpServer exposing Fit or Pivot telemetry tools, schema resource, and analysis prompt.
 */
export function createMcpServer(db: DatabaseSync): McpServer {
  const server = new McpServer({
    name: 'fit-or-pivot-telemetry',
    version: '1.0.0',
  });

  server.registerTool(
    'get_overview_metrics',
    {
      description:
        'Get high-level playtest telemetry overview: session/run counts, win/broke/time/abandoned outcomes, screen drop-offs, segment stats, and top IPs.',
      inputSchema: {
        from: z.number().int().optional().describe('Start timestamp in epoch milliseconds'),
        to: z.number().int().optional().describe('End timestamp in epoch milliseconds'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ from, to }) => jsonToolResult(getOverview(db, { from, to })),
  );

  server.registerTool(
    'list_runs',
    {
      description:
        'List playtest runs with optional filtering by outcome, customer segment, IP, search query, abandoned status, and pagination.',
      inputSchema: {
        outcome: z
          .enum(['win', 'broke', 'time', 'abandoned'])
          .optional()
          .describe('Filter by run outcome (win, broke, time, or abandoned)'),
        segment: z.string().optional().describe('Filter by customer segment played (e.g. students, cafes, teams)'),
        ip: z.string().optional().describe('Filter by client IP address'),
        q: z.string().optional().describe('Search across product_name, product_idea, run_id, session_id, or ip'),
        abandonedOnly: z.boolean().optional().describe('If true, return only runs with no ended_reason'),
        limit: z.number().int().min(1).max(200).optional().describe('Max runs to return (1-200, default 50)'),
        offset: z.number().int().min(0).optional().describe('Pagination offset (default 0)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (opts) => jsonToolResult(listRuns(db, opts)),
  );

  server.registerTool(
    'get_run_timeline',
    {
      description:
        'Get the full timeline for a single playtest run: run summary, monthly simulation rows, and chronological telemetry events.',
      inputSchema: {
        runId: z.string().min(1).describe('The run_id to inspect'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ runId }) => {
      const timeline = getRunTimeline(db, runId);
      if (!timeline) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: JSON.stringify({ error: `Run not found: ${runId}` }) }],
        };
      }
      return jsonToolResult(timeline);
    },
  );

  server.registerTool(
    'get_gameplay_balance',
    {
      description:
        'Analyze gameplay balance: win rates and average final VD%, retention, satisfaction, cash, and months grouped by segment, feature, style, pivots, and interviews.',
      inputSchema: {
        from: z.number().int().optional().describe('Start timestamp in epoch milliseconds'),
        to: z.number().int().optional().describe('End timestamp in epoch milliseconds'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ from, to }) => jsonToolResult(getGameplayBalance(db, { from, to })),
  );

  server.registerTool(
    'get_friction_signals',
    {
      description:
        'Get UI friction signals: disabled button clicks, modal cancellations, setup errors, feature pick limit hits, and average dwell time per screen.',
      inputSchema: {
        from: z.number().int().optional().describe('Start timestamp in epoch milliseconds'),
        to: z.number().int().optional().describe('End timestamp in epoch milliseconds'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ from, to }) => jsonToolResult(getFrictionSignals(db, { from, to })),
  );

  server.registerTool(
    'query_events',
    {
      description:
        'Query raw telemetry events filtered by runId, sessionId, IP, eventType, or actionType, ordered newest first.',
      inputSchema: {
        runId: z.string().optional().describe('Filter by run_id'),
        sessionId: z.string().optional().describe('Filter by session_id'),
        ip: z.string().optional().describe('Filter by client IP'),
        eventType: z.string().optional().describe('Filter by event_type (e.g. month.simulated, ui.disabled_click)'),
        actionType: z.string().optional().describe('Filter by action_type'),
        limit: z.number().int().min(1).max(500).optional().describe('Max events to return (1-500, default 100)'),
      },
      annotations: { readOnlyHint: true },
    },
    async (opts) => jsonToolResult(queryEvents(db, opts)),
  );

  server.registerTool(
    'list_client_errors',
    {
      description: 'List recent client-side JavaScript errors and unhandled promise rejections from playtests.',
      inputSchema: {
        limit: z.number().int().min(1).max(500).optional().describe('Max errors to return (1-500, default 100)'),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ limit }) => jsonToolResult(listClientErrors(db, limit)),
  );

  server.registerResource(
    'telemetry_schema',
    'fit-or-pivot://schema/telemetry',
    {
      title: 'Fit or Pivot Telemetry Schema & Game Constants',
      description: 'SQLite tables, telemetry event taxonomy, and Fit or Pivot game constants.',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'text/markdown',
          text: TELEMETRY_SCHEMA_DOC,
        },
      ],
    }),
  );

  server.registerPrompt(
    'analyze_playtests',
    {
      title: 'Analyze Fit or Pivot Playtests',
      description: 'Workflow for analyzing playtest telemetry, friction signals, and gameplay balance.',
      argsSchema: {
        focus: z.string().optional().describe('Optional focus area (e.g. onboarding, balance, retention, errors)'),
      },
    },
    ({ focus }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: [
              'Analyze the Fit or Pivot playtest telemetry using the MCP tools in this order:',
              '1. Call `get_overview_metrics` to review total sessions, runs, outcome breakdown (win/broke/time/abandoned), screen drop-offs, and segment performance.',
              '2. Call `get_friction_signals` to spot disabled clicks, modal cancellations, setup validation errors, pick limit hits, and high-dwell screens.',
              '3. Call `get_gameplay_balance` to compare win rates and final metrics across segments, features, styles, pivots, and interviews.',
              '4. Call `list_runs` (e.g. filtering by `abandoned`, `broke`, or `win`) and inspect representative runs with `get_run_timeline`.',
              '5. Call `list_client_errors` to check for any client-side runtime errors.',
              focus ? `\nPay special attention to: ${focus}` : '',
            ]
              .filter(Boolean)
              .join('\n'),
          },
        },
      ],
    }),
  );

  return server;
}

/**
 * Handle stateless Streamable HTTP MCP requests on `/mcp`.
 */
export async function handleMcpHttp(
  req: IncomingMessage,
  res: ServerResponse,
  db: DatabaseSync,
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(
      res,
      405,
      {
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      },
      { Allow: 'POST' },
    );
    return;
  }

  let parsedBody: unknown;
  try {
    parsedBody = await readJsonBody(req, MAX_MCP_BODY_BYTES);
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, {
        jsonrpc: '2.0',
        error: { code: -32000, message: err.message },
        id: null,
      });
      return;
    }
    sendJson(res, 400, {
      jsonrpc: '2.0',
      error: { code: -32700, message: 'Invalid JSON' },
      id: null,
    });
    return;
  }

  const server = createMcpServer(db);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  res.on('close', () => {
    void transport.close();
    void server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, parsedBody);
  } catch (err) {
    console.error('[mcp-http] error handling MCP request:', err);
    if (!res.headersSent) {
      sendJson(res, 500, {
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
}
