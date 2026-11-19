import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { ingestBatch } from '../db.js';
import { HttpError, readJsonBody, sendJson } from '../http.js';
import { extractClientIp } from '../ip.js';
import type { TelemetryBatch } from '../../src/shared/telemetry.js';

const ScreenSchema = z.enum([
  'intro',
  'setup',
  'customer',
  'build',
  'testing',
  'result',
  'decide',
  'end',
]);

const FeatureKeySchema = z.enum(['invoice', 'remind', 'team', 'stats', 'design']);
const StyleKeySchema = z.enum(['playful', 'minimal', 'professional']);
const SegmentKeySchema = z.enum(['students', 'cafes', 'teams']);
const DecisionSchema = z.enum(['Launch MVP', 'Persevere', 'Iterate', 'Add a feature', 'Pivot']);
const EndingSchema = z.enum(['win', 'broke', 'time']);
const ModalTypeSchema = z.enum(['help', 'iterate', 'add', 'pivot']);

const EventTypeSchema = z.enum([
  'session.start',
  'run.start',
  'action.dispatched',
  'month.simulated',
  'ui.disabled_click',
  'ui.modal_cancelled',
  'ui.input_blur',
  'ui.backdrop_click',
  'page.visibility',
  'client.error',
]);

const SessionMetaSchema = z.object({
  viewportW: z.number().int().min(0).max(20000),
  viewportH: z.number().int().min(0).max(20000),
  reducedMotion: z.boolean(),
  referrer: z.string().max(512),
  locale: z.string().max(64),
  timezone: z.string().max(64),
});

const StateSummarySchema = z.object({
  screen: ScreenSchema,
  month: z.number().int().min(0).max(100),
  cash: z.number().finite(),
  name: z.string().max(256),
  idea: z.string().max(1024),
  style: StyleKeySchema,
  segment: SegmentKeySchema.nullable(),
  features: z.array(FeatureKeySchema).max(10),
  sat: z.number().finite(),
  ret: z.number().finite(),
  vd: z.number().finite(),
  streak: z.number().int().min(0).max(100),
  pivots: z.number().int().min(0).max(1000),
  interviews: z.number().int().min(0).max(1000),
  modalType: ModalTypeSchema.nullable(),
  ended: EndingSchema.nullable(),
  lastDecision: z.union([DecisionSchema, z.literal('')]),
  pick: z.array(FeatureKeySchema).max(10),
  setupError: z.string().max(512),
});

const TelemetryEventSchema = z.object({
  seq: z.number().int().min(0),
  ts: z.number().finite().min(0),
  sessionId: z.string().min(1).max(128),
  runId: z.string().min(1).max(128),
  eventType: EventTypeSchema,
  actionType: z.string().max(128).optional(),
  screenFrom: ScreenSchema.optional(),
  screenTo: ScreenSchema.optional(),
  durationMs: z.number().finite().min(0).max(86_400_000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  state: StateSummarySchema.optional(),
});

const TelemetryBatchSchema = z.object({
  sessionId: z.string().min(1).max(128),
  meta: SessionMetaSchema.optional(),
  events: z.array(TelemetryEventSchema).min(1).max(100),
});

export async function handleTelemetryPost(
  req: IncomingMessage,
  res: ServerResponse,
  db: DatabaseSync,
): Promise<void> {
  try {
    const rawBody = await readJsonBody(req, 262144);
    const parsed = TelemetryBatchSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new HttpError(400, `Invalid telemetry payload: ${parsed.error.issues[0]?.message ?? 'validation failed'}`);
    }

    const ip = extractClientIp(req);
    const uaHeader = req.headers['user-agent'];
    const userAgent = (Array.isArray(uaHeader) ? uaHeader[0] : uaHeader ?? '').slice(0, 512);
    const batch: TelemetryBatch = parsed.data;

    const result = ingestBatch(db, batch, {
      ip,
      userAgent,
      receivedAt: Date.now(),
    });

    sendJson(res, 202, {
      ok: true,
      accepted: result.accepted,
      inserted: result.inserted,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.status, { ok: false, error: err.message });
      return;
    }
    throw err;
  }
}
