import { describe, expect, it } from 'vitest';
import { reduce } from '../src/game/actions';
import { BURN, START_CASH } from '../src/game/config';
import { endState, linkSentence, makeQuotes, needScore, runMonth } from '../src/game/engine';
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

describe('impact (before and after)', () => {
  const spent = (s: State) => s.impact!.costs.reduce((a, c) => a + c.amount, 0);

  it('launch: before is the starting cash, costs include interviews and burn', () => {
    let s: State = newState();
    s = reduce(s, { type: 'interview', seg: 'students' }, Math.random);
    s = reduce(s, { type: 'interview', seg: 'cafes' }, Math.random);
    s = { ...s, segment: 'students', screen: 'build', pick: ['invoice', 'remind'] };
    s = reduce(s, { type: 'launch' }, fixed(.5));
    expect(s.impact!.before.cash).toBe(START_CASH);
    expect(s.impact!.costs).toEqual([
      { label: 'Launch MVP', amount: 10000 }, { label: 'Interviews', amount: 4000 }, { label: 'Monthly burn', amount: BURN }]);
    expect(s.impact!.after.cash).toBe(START_CASH - 19000);
    expect(s.impact!.before.cash - spent(s)).toBe(s.cash);
    expect(s.interviewSpend).toBe(0);
  });

  it('persevere costs nothing but the burn; after metrics match the state', () => {
    const s = reduce(launched({ screen: 'decide', cash: 50000 }), { type: 'persevere' }, fixed(.5));
    expect(s.impact!.costs).toEqual([{ label: 'Persevere', amount: 0 }, { label: 'Monthly burn', amount: BURN }]);
    expect(s.impact!.before).toEqual({ cash: 50000, sat: 40, ret: 10, vd: 10 });
    expect(s.impact!.after).toEqual({ cash: 45000, sat: s.sat, ret: s.ret, vd: s.vd });
  });

  it('iterate after an interview: before is last month\'s cash, not cash after the decision cost', () => {
    let s = launched({ screen: 'decide', cash: 60000 });
    s = reduce(s, { type: 'interview', seg: 'students' }, Math.random);
    s = reduce(s, { type: 'openIterate' }, fixed(.5));
    s = reduce(s, { type: 'modalField', key: 'style', value: 'minimal' }, fixed(.5));
    s = reduce(s, { type: 'confirmIterate' }, fixed(.5));
    expect(s.impact!.before.cash).toBe(60000);
    expect(s.impact!.costs.map(c => c.amount)).toEqual([4000, 2000, BURN]);
    expect(s.cash).toBe(60000 - 11000);
    expect(s.impact!.before.cash - spent(s)).toBe(s.cash);
  });

  it('pivot: before shows the numbers the player had, not the restarted ones', () => {
    let s = launched({ screen: 'decide', vd: 60, ret: 50, sat: 70, cash: 70000 });
    s = reduce(s, { type: 'openPivot' }, fixed(.5));
    s = reduce(s, { type: 'modalField', key: 'seg', value: 'cafes' }, fixed(.5));
    s = reduce(s, { type: 'confirmPivot' }, fixed(.5));
    expect(s.impact!.before).toEqual({ cash: 70000, sat: 70, ret: 50, vd: 60 });
    expect(s.impact!.costs[0]).toEqual({ label: 'Pivot', amount: 20000 });
    expect(s.impact!.link).toMatch(/^You pivoted to small café owners: numbers restarted/);
  });
});

describe('linkSentence', () => {
  const b = (over: Partial<State> = {}) => launched({ ret: 20, sat: 50, ...over });
  const oneSentence = (t: string) => expect(t.match(/[.!?](\s|$)/g)).toHaveLength(1);

  it('launch MVP: up, flat, down and polite', () => {
    const before = b({ features: [], ret: 10, sat: 40 });
    const after = (ret: number, sat = 40) => b({ features: ['invoice', 'stats'], ret, sat });
    expect(linkSentence('Launch MVP', before, after(25))).toBe('You launched Invoice export and Analytics dashboard for student freelancers: retention rose 15 points — a real first signal.');
    expect(linkSentence('Launch MVP', before, after(11))).toContain('barely moved (+1) — this pair isn’t pulling');
    expect(linkSentence('Launch MVP', before, after(6))).toContain('retention fell 4 points — they aren’t coming back');
    expect(linkSentence('Launch MVP', before, after(10, 55))).toContain('satisfaction rose but retention didn’t — compliments, not fit.');
  });

  it('persevere: up, flat, down', () => {
    expect(linkSentence('Persevere', b(), b({ ret: 29 }))).toBe('You persevered: retention rose 9 points — the trend kept going on its own.');
    expect(linkSentence('Persevere', b(), b({ ret: 21 }))).toBe('You persevered: retention barely moved (+1) — waiting alone isn’t fixing it.');
    expect(linkSentence('Persevere', b(), b({ ret: 20 }))).toContain('retention did not move');
    expect(linkSentence('Persevere', b(), b({ ret: 14 }))).toBe('You persevered: retention fell 6 points — waiting is costing you.');
  });

  it('iterate with a feature swap: up, flat, down, and with a tone change', () => {
    const before = b({ features: ['stats', 'remind'] });
    const after = (ret: number, style: State['style'] = 'playful') => b({ features: ['remind', 'invoice'], ret, style });
    expect(linkSentence('Iterate', before, after(29))).toBe('You swapped Analytics dashboard for Invoice export: retention rose 9 points — that change mattered to student freelancers.');
    expect(linkSentence('Iterate', before, after(19))).toContain('barely moved (-1) — that swap didn’t change much');
    expect(linkSentence('Iterate', before, after(12))).toContain('fell 8 points — student freelancers miss what you took out.');
    expect(linkSentence('Iterate', before, after(29, 'minimal'))).toMatch(/^You swapped Analytics dashboard for Invoice export and went minimal:/);
  });

  it('iterate with only a tone change: up, flat, down', () => {
    const after = (ret: number) => b({ style: 'minimal', ret });
    expect(linkSentence('Iterate', b(), after(26))).toBe('You switched to a minimal tone: retention rose 6 points — it suits student freelancers better.');
    expect(linkSentence('Iterate', b(), after(22))).toContain('tone alone won’t fix the product.');
    expect(linkSentence('Iterate', b(), after(15))).toContain('liked the old tone better.');
  });

  it('add a feature: up, flat, down, and polite for design', () => {
    const before = b({ features: ['invoice', 'stats'] });
    const after = (f: FeatureKey, ret: number, sat = 50) => b({ features: ['invoice', 'stats', f], ret, sat });
    expect(linkSentence('Add a feature', before, after('remind', 30))).toBe('You added Smart reminders: retention rose 10 points — this time more product did help.');
    expect(linkSentence('Add a feature', before, after('team', 21))).toContain('more product didn’t create more value.');
    expect(linkSentence('Add a feature', before, after('team', 16))).toContain('more product made it worse.');
    expect(linkSentence('Add a feature', before, after('design', 21, 62))).toBe('You added Polished design: satisfaction rose but retention didn’t — compliments, not fit.');
  });

  it('pivot: compares with the restart point, up, flat, down', () => {
    const before = b({ ret: 40 });
    const after = (ret: number) => b({ segment: 'cafes', ret });
    expect(linkSentence('Pivot', before, after(14))).toBe('You pivoted to small café owners: numbers restarted and retention already climbed to 14% — watch the next two months.');
    expect(linkSentence('Pivot', before, after(9))).toContain('retention sits at 9%');
    expect(linkSentence('Pivot', before, after(4))).toContain('retention slipped to 4%');
  });

  it('is always one sentence and never mentions the hidden needs', () => {
    const cases: [Parameters<typeof linkSentence>[0], State, State][] = [
      ['Persevere', b(), b({ ret: 40 })], ['Pivot', b(), b({ segment: 'teams' })],
      ['Iterate', b(), b({ style: 'professional', sat: 80 })], ['Add a feature', b({ features: ['invoice'] }), b({ features: ['invoice', 'team'] })],
    ];
    for (const [d, x, y] of cases) {
      const t = linkSentence(d, x, y);
      oneSentence(t);
      expect(t).not.toMatch(/weight|need|0\.\d/i);
    }
  });
});
