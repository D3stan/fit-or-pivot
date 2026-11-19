import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reduce } from '../src/game/actions';
import { ADD_COST, FEATURE_COST, INTERVIEW_COST, MVP_FEATURES } from '../src/game/config';
import { score } from '../src/game/engine';
import { newState } from '../src/game/state';
import type { State } from '../src/game/types';
import { summarizeState, type SessionMeta, type TelemetryBatch } from '../src/shared/telemetry';
import { createTelemetryClient, type StorageLike } from '../src/telemetry/client';

function makeMemoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map<string, string>(Object.entries(initial));
  return {
    getItem: key => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

const sampleMeta: SessionMeta = {
  viewportW: 1280,
  viewportH: 800,
  reducedMotion: false,
  referrer: 'https://example.com/',
  locale: 'en-US',
  timezone: 'UTC',
};

function makeHarness(opts: {
  storage?: StorageLike;
  startTime?: number;
  sendFn?: (batch: TelemetryBatch) => Promise<void> | void;
  beaconFn?: (batch: TelemetryBatch) => boolean;
} = {}) {
  let time = opts.startTime ?? 1000;
  let idCounter = 0;
  const batches: TelemetryBatch[] = [];
  const beaconBatches: TelemetryBatch[] = [];
  const storage = opts.storage ?? makeMemoryStorage();

  const client = createTelemetryClient({
    storage,
    now: () => time,
    uuidFn: () => `uuid-${++idCounter}`,
    collectMeta: () => sampleMeta,
    sendFn: opts.sendFn ?? (batch => { batches.push(batch); }),
    beaconFn: opts.beaconFn ?? (batch => {
      beaconBatches.push(batch);
      return true;
    }),
  });

  return {
    client,
    storage,
    batches,
    beaconBatches,
    advanceTime: (ms: number) => {
      time += ms;
    },
    allEvents: () => batches.flatMap(b => b.events),
  };
}

describe('summarizeState', () => {
  it('produces a compact snapshot and clones array fields', () => {
    const s: State = {
      ...newState(),
      screen: 'decide',
      month: 3,
      cash: 75000,
      name: 'Flowly',
      idea: 'Tasks for teams',
      segment: 'teams',
      features: ['team', 'stats'],
      pick: ['team'],
      modal: { type: 'add', add: 'design' },
    };

    const summary = summarizeState(s);
    expect(summary).toEqual({
      screen: 'decide',
      month: 3,
      cash: 75000,
      name: 'Flowly',
      idea: 'Tasks for teams',
      style: s.style,
      segment: 'teams',
      features: ['team', 'stats'],
      sat: s.sat,
      ret: s.ret,
      vd: s.vd,
      streak: s.streak,
      pivots: 0,
      interviews: 0,
      modalType: 'add',
      ended: null,
      lastDecision: '',
      pick: ['team'],
      setupError: '',
    });

    summary.features.push('design');
    summary.pick.push('stats');
    expect(s.features).toEqual(['team', 'stats']);
    expect(s.pick).toEqual(['team']);
  });
});

describe('createTelemetryClient session & run lifecycle', () => {
  it('persists sessionId in storage, reuses it, and rotates runId with monotonic seq', async () => {
    const storage = makeMemoryStorage();
    const h1 = makeHarness({ storage });
    const s0 = newState();

    h1.client.startSession(s0);
    const firstSessionId = h1.client.getSessionId();
    const firstRunId = h1.client.getRunId();
    expect(storage.getItem('fop_session_id')).toBe(firstSessionId);

    h1.advanceTime(250);
    h1.client.startNewRun(s0);
    const secondRunId = h1.client.getRunId();
    expect(secondRunId).not.toBe(firstRunId);
    expect(h1.client.getSessionId()).toBe(firstSessionId);

    await h1.client.flush();
    expect(h1.batches).toHaveLength(1);
    expect(h1.batches[0].meta).toEqual(sampleMeta);

    const events = h1.allEvents();
    expect(events.map(e => e.eventType)).toEqual(['session.start', 'run.start', 'run.start']);
    expect(events.map(e => e.seq)).toEqual([1, 2, 3]);
    expect(events[0].runId).toBe(firstRunId);
    expect(events[1].runId).toBe(firstRunId);
    expect(events[2].runId).toBe(secondRunId);

    // A second client sharing storage reuses the stored sessionId.
    const h2 = makeHarness({ storage });
    expect(h2.client.getSessionId()).toBe(firstSessionId);
  });
});

describe('createTelemetryClient batching & flushing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-flushes when queue reaches 15 items', () => {
    const h = makeHarness();
    const s = newState();

    // 15 UI events -> triggers immediate flush at 15
    for (let i = 0; i < 15; i++) {
      h.client.recordUiEvent('ui.backdrop_click', s, { n: i });
    }
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0].events).toHaveLength(15);
  });

  it('auto-flushes after 3000ms timer', async () => {
    const h = makeHarness();
    const s = newState();

    h.client.recordUiEvent('ui.backdrop_click', s);
    expect(h.batches).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(2999);
    expect(h.batches).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(h.batches).toHaveLength(1);
    expect(h.batches[0].events).toHaveLength(1);
  });

  it('swallows sendFn errors without throwing', async () => {
    const h = makeHarness({
      sendFn: async () => {
        throw new Error('network down');
      },
    });
    h.client.recordUiEvent('ui.backdrop_click', newState());
    await expect(h.client.flush()).resolves.toBeUndefined();
  });

  it('flushBeacon drains synchronously so visibilitychange + pagehide never double-send', () => {
    const h = makeHarness();
    const s = newState();

    h.client.startSession(s);
    h.client.flushBeacon(); // e.g. visibilitychange -> hidden
    h.client.flushBeacon(); // e.g. immediate pagehide

    expect(h.beaconBatches).toHaveLength(1);
    expect(h.beaconBatches[0].events).toHaveLength(2);
    expect(h.batches).toHaveLength(0);
  });

  it('flushBeacon falls back to sendFn when beaconFn returns false', () => {
    const h = makeHarness({
      beaconFn: () => false,
    });
    h.client.recordUiEvent('page.visibility', newState(), { state: 'hidden' });
    h.client.flushBeacon();

    expect(h.batches).toHaveLength(1);
    expect(h.batches[0].events).toHaveLength(1);
  });
});

describe('createTelemetryClient recordDispatch', () => {
  it('skips action.dispatched on modalField when rerender is false, but records when rerender is true', async () => {
    const h = makeHarness();
    const prev: State = {
      ...newState(),
      screen: 'decide',
      modal: { type: 'pivot', seg: '', idea: 'Old', style: 'minimal' },
    };

    const nextSilent = reduce(prev, { type: 'modalField', key: 'idea', value: 'New' }, Math.random);
    h.client.recordDispatch(prev, { type: 'modalField', key: 'idea', value: 'New' }, nextSilent, false);

    const nextChange = reduce(nextSilent, { type: 'modalField', key: 'seg', value: 'cafes' }, Math.random);
    h.client.recordDispatch(nextSilent, { type: 'modalField', key: 'seg', value: 'cafes' }, nextChange, true);

    await h.client.flush();
    const events = h.allEvents();
    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe('action.dispatched');
    expect(events[0].payload?.key).toBe('seg');
    expect(events[0].payload?.value).toBe('cafes');
  });

  it('emits ui.modal_cancelled only on non-help modal close with draft fields and dwell durationMs', async () => {
    const h = makeHarness({ startTime: 1000 });
    const base: State = { ...newState(), screen: 'decide', segment: 'students', features: ['invoice', 'remind'] };

    // Open iterate modal at t=1000
    const opened = reduce(base, { type: 'openIterate' }, Math.random);
    h.client.recordDispatch(base, { type: 'openIterate' }, opened, true);

    // Edit modal field at t=1500
    h.advanceTime(500);
    const edited = reduce(opened, { type: 'modalField', key: 'remove', value: 'invoice' }, Math.random);
    h.client.recordDispatch(opened, { type: 'modalField', key: 'remove', value: 'invoice' }, edited, true);

    // Close iterate modal at t=2200 -> dwell = 1200ms
    h.advanceTime(700);
    const closed = reduce(edited, { type: 'close' }, Math.random);
    h.client.recordDispatch(edited, { type: 'close' }, closed, true);

    // Open and close help modal -> should NOT emit ui.modal_cancelled
    const helpOpened = reduce(closed, { type: 'help' }, Math.random);
    h.client.recordDispatch(closed, { type: 'help' }, helpOpened, true);
    const helpClosed = reduce(helpOpened, { type: 'close' }, Math.random);
    h.client.recordDispatch(helpOpened, { type: 'close' }, helpClosed, true);

    await h.client.flush();
    const cancelled = h.allEvents().filter(e => e.eventType === 'ui.modal_cancelled');
    expect(cancelled).toHaveLength(1);
    expect(cancelled[0].durationMs).toBe(1200);
    expect(cancelled[0].payload).toMatchObject({
      modalType: 'iterate',
      type: 'iterate',
      remove: 'invoice',
      add: '',
    });
  });

  it('flags pickLimitHit on 3rd feature click in build screen', async () => {
    const h = makeHarness();
    let s: State = { ...newState(), screen: 'build', segment: 'students' };

    const s1 = reduce(s, { type: 'feat', f: 'invoice' }, Math.random);
    h.client.recordDispatch(s, { type: 'feat', f: 'invoice' }, s1, true);
    s = s1;

    const s2 = reduce(s, { type: 'feat', f: 'remind' }, Math.random);
    h.client.recordDispatch(s, { type: 'feat', f: 'remind' }, s2, true);
    s = s2;

    const s3 = reduce(s, { type: 'feat', f: 'design' }, Math.random);
    h.client.recordDispatch(s, { type: 'feat', f: 'design' }, s3, true);

    await h.client.flush();
    const events = h.allEvents();
    expect(events).toHaveLength(3);
    expect(events[0].payload?.pickLimitHit).toBeUndefined();
    expect(events[1].payload?.pickLimitHit).toBeUndefined();
    expect(events[2].payload).toMatchObject({
      f: 'design',
      pickCountBefore: 2,
      pickCountAfter: 2,
      pickLimitHit: true,
    });
  });

  it('emits month.simulated with cost, interviewSpend, and score on win', async () => {
    const h = makeHarness();
    const rng = () => 0.5;

    // Customer interview + launch MVP
    let s: State = { ...newState(), screen: 'customer', name: 'Flowly' };
    const afterInterview = reduce(s, { type: 'interview', seg: 'students' }, rng);
    h.client.recordDispatch(s, { type: 'interview', seg: 'students' }, afterInterview, true);
    s = afterInterview;

    s = { ...s, screen: 'build', segment: 'students', pick: ['invoice', 'remind'] };
    const launched = reduce(s, { type: 'launch' }, rng);
    h.client.recordDispatch(s, { type: 'launch' }, launched, true);

    // Simulate winning on `next` after 3-month streak
    const preWin: State = {
      ...launched,
      screen: 'result',
      month: 5,
      cash: 50000,
      streak: 3,
      ended: null,
    };
    const won = reduce(preWin, { type: 'next' }, rng);
    h.client.recordDispatch(preWin, { type: 'next' }, won, true);

    await h.client.flush();
    const events = h.allEvents();

    const sim = events.find(e => e.eventType === 'month.simulated');
    expect(sim).toBeDefined();
    expect(sim?.payload).toMatchObject({
      month: 1,
      decision: 'Launch MVP',
      segment: 'students',
      cost: FEATURE_COST * MVP_FEATURES,
      interviewSpend: INTERVIEW_COST,
      ended: null,
    });

    const winDispatch = events.find(e => e.eventType === 'action.dispatched' && e.actionType === 'next');
    expect(winDispatch?.payload?.score).toBe(score(won));
  });

  it('records setupError when setupDone fails validation and decision cost on confirmAdd', async () => {
    const h = makeHarness();
    const s0: State = { ...newState(), screen: 'setup' };
    const sErr = reduce(s0, { type: 'setupDone', name: '  ', idea: 'Test' }, Math.random);
    h.client.recordDispatch(s0, { type: 'setupDone', name: '  ', idea: 'Test' }, sErr, true);

    const sModal: State = {
      ...newState(),
      screen: 'decide',
      segment: 'students',
      features: ['invoice', 'remind'],
      modal: { type: 'add', add: 'design' },
    };
    const sAdded = reduce(sModal, { type: 'confirmAdd' }, () => 0.5);
    h.client.recordDispatch(sModal, { type: 'confirmAdd' }, sAdded, true);

    await h.client.flush();
    const events = h.allEvents();
    expect(events[0].payload?.setupError).toBeTruthy();

    const sim = events.find(e => e.eventType === 'month.simulated');
    expect(sim?.payload?.cost).toBe(ADD_COST);
  });
});

describe('createTelemetryClient recordUiEvent & recordError', () => {
  it('records UI events and client errors with state summary', async () => {
    const h = makeHarness();
    const s: State = { ...newState(), screen: 'build', segment: 'cafes' };

    h.client.recordUiEvent('ui.disabled_click', s, { action: 'launch' });
    h.client.recordUiEvent('ui.input_blur', s, { fieldId: 'name', length: 6, prevLength: 0 }, 420);
    h.client.recordError({ message: 'Boom', stack: 'Error: Boom\n at test', source: 'window.error' }, s);

    await h.client.flush();
    const events = h.allEvents();
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      eventType: 'ui.disabled_click',
      screenFrom: 'build',
      screenTo: 'build',
      payload: { action: 'launch' },
    });
    expect(events[1]).toMatchObject({
      eventType: 'ui.input_blur',
      durationMs: 420,
      payload: { fieldId: 'name', length: 6, prevLength: 0 },
    });
    expect(events[2]).toMatchObject({
      eventType: 'client.error',
      payload: { message: 'Boom', stack: 'Error: Boom\n at test', source: 'window.error' },
    });
    expect(events[2].state?.segment).toBe('cafes');
  });
});
