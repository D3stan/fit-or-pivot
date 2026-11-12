import { describe, expect, it } from 'vitest';
import { reduce } from '../src/game/actions';
import { BURN, START_CASH } from '../src/game/config';
import { endState, makeQuotes, needScore, runMonth } from '../src/game/engine';
import { newState } from '../src/game/state';
import type { FeatureKey, SegmentKey, State } from '../src/game/types';

/** Small seeded PRNG (mulberry32) so runs are reproducible. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fixed = (v: number) => () => v;

function launched(over: Partial<State> = {}): State {
  return { ...newState(), name: 'Flowly', segment: 'students', features: ['invoice', 'remind'], screen: 'build', ...over };
}

describe('needScore', () => {
  const all = ['invoice', 'remind', 'team', 'stats', 'design'] as FeatureKey[];
  it('stays within 0..1 for every segment and feature set', () => {
    for (const seg of ['students', 'cafes', 'teams'] as SegmentKey[]) {
      expect(needScore(seg, [])).toBe(0);
      expect(needScore(seg, all)).toBe(1);
      for (const a of all) for (const b of all) {
        const n = needScore(seg, [a, b]);
        expect(n).toBeGreaterThanOrEqual(0);
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });
  it('rewards the right features', () => {
    expect(needScore('students', ['invoice', 'remind'])).toBe(1);
    expect(needScore('students', ['design', 'stats'])).toBeLessThan(.1);
  });
});

describe('runMonth', () => {
  it('is deterministic for a given seed and does not mutate its input', () => {
    const s = launched();
    const copy = structuredClone(s);
    const a = runMonth(s, 'Launch MVP', seeded(42));
    const b = runMonth(s, 'Launch MVP', seeded(42));
    expect(a).toEqual(b);
    expect(s).toEqual(copy);
  });

  it('advances the month, burns cash and records history', () => {
    const s = runMonth(launched(), 'Persevere', fixed(.5));
    expect(s.month).toBe(1);
    expect(s.cash).toBe(START_CASH - BURN);
    expect(s.prev).toEqual({ sat: 40, ret: 10, vd: 10, cash: START_CASH });
    expect(s.history).toHaveLength(1);
    expect(s.history[0]).toMatchObject({ month: 1, decision: 'Persevere', segment: 'students', cash: START_CASH - BURN });
    // jitter is 0 at rng=.5: vd = round(10 + .45*(60-10)) = 33
    expect(s.vd).toBe(33);
    expect(s.ret).toBe(Math.round(10 + .45 * (53 - 10)));
  });

  it('keeps metrics within 0..100 under extreme randomness', () => {
    let s = launched();
    for (let i = 0; i < 12; i++) s = runMonth(s, 'Persevere', fixed(.999));
    for (const v of [s.vd, s.ret, s.sat]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
  });
});

describe('endState', () => {
  it('wins after a 3-month fit streak', () => {
    let s = launched();
    const endings: (string | null)[] = [];
    for (let i = 0; i < 6 && !endState(s); i++) { s = runMonth(s, 'Persevere', fixed(.5)); endings.push(endState(s)); }
    expect(s.streak).toBe(3);
    expect(endState(s)).toBe('win');
    expect(endings.filter(e => e === 'win')).toHaveLength(1);
  });

  it('a fit streak resets when a month misses', () => {
    const s = runMonth(launched({ streak: 2, vd: 0, ret: 0, features: ['design', 'stats'] }), 'Persevere', fixed(.5));
    expect(s.streak).toBe(0);
  });

  it('is broke when cash reaches 0', () => {
    expect(endState({ ...newState(), cash: 0 })).toBe('broke');
    const s = runMonth(launched({ cash: BURN, features: ['design'] }), 'Persevere', fixed(.5));
    expect(endState(s)).toBe('broke');
  });

  it('runs out of time at month 12', () => {
    let s = launched({ features: ['design', 'stats'] });
    while (!endState(s)) s = runMonth(s, 'Persevere', fixed(.5));
    expect(s.month).toBe(12);
    expect(endState(s)).toBe('time');
  });

  it('win beats broke', () => {
    expect(endState({ ...newState(), streak: 3, cash: -1 })).toBe('win');
  });
});

describe('makeQuotes', () => {
  it('returns at most 3 distinct quotes', () => {
    for (const features of [['design'], ['invoice', 'remind'], ['design', 'stats', 'team', 'remind']] as FeatureKey[][]) {
      for (const r of [0, .99]) {
        const s = launched({ features, style: 'professional', sat: 90, ret: 5 });
        const q = makeQuotes(s, needScore('students', features), 0, fixed(r));
        expect(q.length).toBeLessThanOrEqual(3);
        expect(new Set(q).size).toBe(q.length);
      }
    }
  });
  it('fills in the product name as plain text', () => {
    const q = makeQuotes(launched({ name: '<b>X</b>' }), 1, 1, fixed(0));
    expect(q[0]).toContain('<b>X</b>');
  });
});

describe('actions', () => {
  it('pivot resets metrics, charges the pivot and runs a month', () => {
    let s = launched({ screen: 'decide', vd: 60, ret: 50, sat: 70, streak: 2 });
    s = reduce(s, { type: 'openPivot' }, fixed(.5));
    s = reduce(s, { type: 'modalField', key: 'seg', value: 'cafes' }, fixed(.5));
    s = reduce(s, { type: 'modalField', key: 'idea', value: '  Shift plans  ' }, fixed(.5));
    s = reduce(s, { type: 'confirmPivot' }, fixed(.5));
    expect(s.modal).toBeNull();
    expect(s.segment).toBe('cafes');
    expect(s.idea).toBe('Shift plans');
    expect(s.pivots).toBe(1);
    expect(s.prev).toEqual({ ret: 8, vd: 10, sat: 40, cash: START_CASH - 20000 });
    expect(s.cash).toBe(START_CASH - 20000 - BURN);
    expect(s.streak).toBe(0);
    expect(s.screen).toBe('testing');
    expect(s.history.at(-1)?.decision).toBe('Pivot');
  });

  it('launch needs exactly 2 picked features', () => {
    let s: State = { ...newState(), segment: 'students', screen: 'build' };
    s = reduce(s, { type: 'feat', f: 'invoice' }, Math.random);
    expect(reduce(s, { type: 'launch' }, Math.random)).toBe(s);
    s = reduce(s, { type: 'feat', f: 'remind' }, Math.random);
    s = reduce(s, { type: 'feat', f: 'team' }, Math.random);
    expect(s.pick).toEqual(['invoice', 'remind']);
    const t = reduce(s, { type: 'launch' }, fixed(.5));
    expect(t.features).toEqual(['invoice', 'remind']);
    expect(t.cash).toBe(START_CASH - 10000 - BURN);
  });

  it('interviews cost money and run out', () => {
    let s = newState();
    for (let i = 0; i < 3; i++) s = reduce(s, { type: 'interview', seg: 'cafes' }, Math.random);
    expect(s.notes.cafes).toHaveLength(2);
    expect(s.interviews).toBe(2);
    expect(s.cash).toBe(START_CASH - 4000);
  });

  it('setup requires a name', () => {
    const s = reduce(newState(), { type: 'setupDone', name: '  ', idea: 'x' }, Math.random);
    expect(s.screen).toBe('intro');
    expect(s.setupError).not.toBe('');
  });
});
