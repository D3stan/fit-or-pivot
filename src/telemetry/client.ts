import type { Action } from '../game/actions';
import { score } from '../game/engine';
import type { State } from '../game/types';
import {
  summarizeState,
  type SessionMeta,
  type TelemetryBatch,
  type TelemetryEvent,
  type TelemetryEventType,
} from '../shared/telemetry';

const SESSION_STORAGE_KEY = 'fop_session_id';
const DEFAULT_FLUSH_INTERVAL_MS = 3000;
const DEFAULT_MAX_BATCH_SIZE = 15;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface TelemetryClientOptions {
  sendFn?: (batch: TelemetryBatch) => Promise<void> | void;
  beaconFn?: (batch: TelemetryBatch) => boolean;
  storage?: StorageLike | null;
  now?: () => number;
  uuidFn?: () => string;
  flushIntervalMs?: number;
  maxBatchSize?: number;
  collectMeta?: () => SessionMeta;
}

export interface TelemetryClient {
  getSessionId(): string;
  getRunId(): string;
  startSession(state: State): void;
  startNewRun(state: State): void;
  recordDispatch(prev: State, action: Action, next: State, rerender: boolean): void;
  recordUiEvent(
    eventType: TelemetryEventType,
    state: State,
    payload?: Record<string, unknown>,
    durationMs?: number,
  ): void;
  recordError(err: { message: string; stack?: string; source?: string }, state: State): void;
  flush(): Promise<void>;
  flushBeacon(): void;
}

function defaultUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultStorage(): StorageLike | null {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage;
  } catch {
    // Ignore storage access errors in restricted contexts.
  }
  return null;
}

function defaultCollectMeta(): SessionMeta {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      viewportW: 0,
      viewportH: 0,
      reducedMotion: false,
      referrer: '',
      locale: '',
      timezone: '',
    };
  }
  let timezone = '';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    timezone = '';
  }
  return {
    viewportW: window.innerWidth ?? 0,
    viewportH: window.innerHeight ?? 0,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    referrer: typeof document !== 'undefined' ? (document.referrer ?? '') : '',
    locale: navigator.language ?? '',
    timezone,
  };
}

async function defaultSendFn(batch: TelemetryBatch): Promise<void> {
  if (typeof fetch !== 'function') return;
  await fetch('/api/telemetry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
    keepalive: true,
  });
}

function defaultBeaconFn(batch: TelemetryBatch): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([JSON.stringify(batch)], { type: 'application/json' });
    return navigator.sendBeacon('/api/telemetry', blob);
  }
  return false;
}

function sanitizeActionParams(action: Action): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  if ('seg' in action && action.seg !== undefined) params.seg = action.seg;
  if ('f' in action && action.f !== undefined) params.f = action.f;
  if ('style' in action && action.style !== undefined) params.style = action.style;
  if ('key' in action && action.key !== undefined) params.key = action.key;
  if ('value' in action && action.value !== undefined) params.value = action.value;
  return params;
}

function extractDecisionCost(state: State): number {
  if (!state.impact?.costs) return 0;
  return state.impact.costs
    .filter(c => c.label !== 'Monthly burn' && c.label !== 'Interviews')
    .reduce((sum, c) => sum + c.amount, 0);
}

export function createTelemetryClient(options: TelemetryClientOptions = {}): TelemetryClient {
  const now = options.now ?? (() => Date.now());
  const uuidFn = options.uuidFn ?? defaultUuid;
  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const sendFn = options.sendFn ?? defaultSendFn;
  const beaconFn = options.beaconFn ?? defaultBeaconFn;
  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  const maxBatchSize = options.maxBatchSize ?? DEFAULT_MAX_BATCH_SIZE;
  const collectMeta = options.collectMeta ?? defaultCollectMeta;

  let sessionId = '';
  try {
    sessionId = storage?.getItem(SESSION_STORAGE_KEY) || '';
  } catch {
    sessionId = '';
  }
  if (!sessionId) {
    sessionId = uuidFn();
    try {
      storage?.setItem(SESSION_STORAGE_KEY, sessionId);
    } catch {
      // Ignore storage write errors.
    }
  }

  let runId = uuidFn();
  let seq = 0;
  let screenEnteredAt = now();
  let modalOpenedAt: number | null = null;
  let lastEventAt = screenEnteredAt;
  let meta: SessionMeta | undefined;
  let metaSent = false;

  const queue: TelemetryEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clearFlushTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function scheduleFlush(): void {
    if (timer !== null || queue.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      void flush();
    }, flushIntervalMs);
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
      (timer as { unref?: () => void }).unref?.();
    }
  }

  function buildBatch(events: TelemetryEvent[]): TelemetryBatch {
    const batch: TelemetryBatch = { sessionId, events };
    if (!metaSent) {
      meta = meta ?? collectMeta();
      batch.meta = meta;
      metaSent = true;
    }
    return batch;
  }

  function enqueue(event: Omit<TelemetryEvent, 'seq' | 'ts' | 'sessionId' | 'runId'>, ts = now()): void {
    seq += 1;
    lastEventAt = ts;
    queue.push({
      seq,
      ts,
      sessionId,
      runId,
      ...event,
    });
    if (queue.length >= maxBatchSize) {
      void flush();
    } else {
      scheduleFlush();
    }
  }

  async function flush(): Promise<void> {
    clearFlushTimer();
    if (queue.length === 0) return;
    const events = queue.splice(0, queue.length);
    const batch = buildBatch(events);
    try {
      await sendFn(batch);
    } catch {
      // Telemetry must never throw into app code.
    }
  }

  function flushBeacon(): void {
    clearFlushTimer();
    if (queue.length === 0) return;
    const events = queue.splice(0, queue.length);
    const batch = buildBatch(events);
    let sent = false;
    try {
      sent = beaconFn(batch);
    } catch {
      sent = false;
    }
    if (!sent) {
      try {
        void Promise.resolve(sendFn(batch)).catch(() => {});
      } catch {
        // Telemetry must never throw into app code.
      }
    }
  }

  function startSession(state: State): void {
    const t = now();
    meta = collectMeta();
    metaSent = false;
    screenEnteredAt = t;
    modalOpenedAt = state.modal ? t : null;
    const summary = summarizeState(state);
    enqueue({
      eventType: 'session.start',
      screenTo: state.screen,
      state: summary,
    }, t);
    enqueue({
      eventType: 'run.start',
      screenTo: state.screen,
      state: summary,
    }, t);
  }

  function startNewRun(state: State): void {
    const t = now();
    runId = uuidFn();
    screenEnteredAt = t;
    modalOpenedAt = state.modal ? t : null;
    enqueue({
      eventType: 'run.start',
      screenTo: state.screen,
      state: summarizeState(state),
    }, t);
  }

  function recordDispatch(prev: State, action: Action, next: State, rerender: boolean): void {
    if (action.type === 'modalField' && !rerender) return;

    const t = now();
    const durationMs = Math.max(0, t - screenEnteredAt);
    const summary = summarizeState(next);

    const payload: Record<string, unknown> = {
      stateChanged: next !== prev,
      ...sanitizeActionParams(action),
    };
    if (next.setupError) payload.setupError = next.setupError;
    if (action.type === 'feat') {
      payload.pickCountBefore = prev.pick.length;
      payload.pickCountAfter = next.pick.length;
      if (prev.pick.length === next.pick.length && !prev.pick.includes(action.f)) {
        payload.pickLimitHit = true;
      }
    }
    if (action.type === 'next' && next.ended === 'win') {
      payload.score = score(next);
    }

    enqueue({
      eventType: 'action.dispatched',
      actionType: action.type,
      screenFrom: prev.screen,
      screenTo: next.screen,
      durationMs,
      payload,
      state: summary,
    }, t);

    if (action.type === 'close' && prev.modal && prev.modal.type !== 'help' && next.modal === null) {
      enqueue({
        eventType: 'ui.modal_cancelled',
        screenFrom: prev.screen,
        screenTo: next.screen,
        durationMs: modalOpenedAt !== null ? Math.max(0, t - modalOpenedAt) : undefined,
        payload: {
          modalType: prev.modal.type,
          ...prev.modal,
        },
        state: summary,
      }, t);
    }

    if (next.history.length > prev.history.length) {
      const latest = next.history[next.history.length - 1];
      enqueue({
        eventType: 'month.simulated',
        screenFrom: prev.screen,
        screenTo: next.screen,
        payload: {
          ...latest,
          cost: extractDecisionCost(next),
          interviewSpend: prev.interviewSpend,
          ended: next.ended,
          ...(next.ended === 'win' ? { score: score(next) } : {}),
        },
        state: summary,
      }, t);
    }

    if (!prev.modal && next.modal) {
      modalOpenedAt = t;
    } else if (prev.modal && !next.modal) {
      modalOpenedAt = null;
    } else if (prev.modal && next.modal && prev.modal.type !== next.modal.type) {
      modalOpenedAt = t;
    }

    if (next.screen !== prev.screen) {
      screenEnteredAt = t;
    }
    // Keep lastEventAt referenced even if only read internally.
    void lastEventAt;
  }

  function recordUiEvent(
    eventType: TelemetryEventType,
    state: State,
    payload?: Record<string, unknown>,
    durationMs?: number,
  ): void {
    enqueue({
      eventType,
      screenFrom: state.screen,
      screenTo: state.screen,
      ...(durationMs !== undefined ? { durationMs } : {}),
      ...(payload !== undefined ? { payload } : {}),
      state: summarizeState(state),
    });
  }

  function recordError(err: { message: string; stack?: string; source?: string }, state: State): void {
    enqueue({
      eventType: 'client.error',
      screenFrom: state.screen,
      screenTo: state.screen,
      payload: {
        message: err.message,
        ...(err.stack ? { stack: err.stack } : {}),
        ...(err.source ? { source: err.source } : {}),
      },
      state: summarizeState(state),
    });
  }

  return {
    getSessionId: () => sessionId,
    getRunId: () => runId,
    startSession,
    startNewRun,
    recordDispatch,
    recordUiEvent,
    recordError,
    flush,
    flushBeacon,
  };
}

export const telemetry = createTelemetryClient();
