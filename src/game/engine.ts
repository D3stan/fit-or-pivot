// Pure game rules. No DOM, no timers; randomness is injected as `rng`.
import { clamp, eur } from '../format';
import { BURN, MAX_MONTH, POLITE_GAP, RET_TARGET, VD_TARGET, WIN_STREAK } from './config';
import { FEATURES, SEGMENTS } from './content';
import type { Decision, Ending, FeatureKey, Message, Rng, Segment, SegmentKey, State } from './types';

export function segmentOf(s: State): Segment {
  if (!s.segment) throw new Error('No customer segment chosen yet');
  return SEGMENTS[s.segment];
}

export const runway = (s: State): number => Math.max(0, Math.floor(s.cash / BURN));

export const isFit = (vd: number, ret: number): boolean => vd >= VD_TARGET && ret >= RET_TARGET;

/** How well the features solve the segment's real problem, 0..1. */
export function needScore(segment: SegmentKey, features: FeatureKey[]): number {
  const need = SEGMENTS[segment].need;
  let s = 0;
  features.forEach(f => s += need[f]);
  return Math.pow(Math.min(1, s / 0.8), 1.3);
}

/** Simulate one month of customers using the product. */
export function runMonth(s: State, decision: Decision, rng: Rng): State {
  const seg = segmentOf(s);
  const n = needScore(s.segment!, s.features);
  const sm = s.style === seg.style ? 1 : 0;
  const d = s.features.includes('design') ? 1 : 0;
  const tVD = 6 + 50 * n + 4 * sm;
  const tRet = 6 + 42 * n + 5 * sm;
  const tSat = Math.min(95, 30 + 25 * n + 18 * d + 6 * sm);
  const jit = () => Math.round(rng() * 4 - 2);
  // Order of rng calls (vd, ret, sat, then quotes) is part of the deterministic contract.
  const vd = clamp(Math.round(s.vd + .45 * (tVD - s.vd)) + jit(), 0, 100);
  const ret = clamp(Math.round(s.ret + .45 * (tRet - s.ret)) + jit(), 0, 100);
  const sat = clamp(Math.round(s.sat + .45 * (tSat - s.sat)) + jit(), 0, 100);
  const month = s.month + 1;
  const cash = s.cash - BURN;
  const streak = isFit(vd, ret) ? s.streak + 1 : 0;
  const next: State = {
    ...s,
    prev: { sat: s.sat, ret: s.ret, vd: s.vd, cash: s.cash },
    month, cash, vd, ret, sat, streak,
    lastDecision: decision,
    everDesign: s.everDesign || d === 1,
    history: [...s.history, {
      month, vd, ret, sat, cash, decision,
      segment: s.segment!, features: [...s.features], style: s.style,
    }],
  };
  return { ...next, quotes: makeQuotes(next, n, sm, rng), msg: makeMessage(next) };
}

/** Up to 3 distinct customer quotes (plain text, not HTML). */
export function makeQuotes(s: State, n: number, sm: number, rng: Rng): string[] {
  const seg = segmentOf(s), has = (f: FeatureKey) => s.features.includes(f), nm = s.name || 'this app';
  const fill = (t: string) => t.replace('{name}', nm);
  const c: string[] = [];
  c.push(has(seg.primary) ? fill(seg.q.got1) : seg.q.miss1);
  if (has('design')) c.push(n < .6 ? `“Nice design. I'm not sure what problem ${nm} solves for me.”` : '“It looks great, and it actually helps.”');
  if (s.sat - s.ret >= POLITE_GAP) c.push('“Love the idea, but I forgot to open it again.”');
  if (rng() < .7) c.push(has(seg.secondary) ? fill(seg.q.got2) : seg.q.miss2);
  if (!sm) c.push(seg.q.tone);
  c.push(n > .8 ? `“${nm} saves me time every week. I would be upset if it disappeared.”`
                : `“I tried ${nm} a couple of times and went back to my old way of doing things.”`);
  return [...new Set(c)].slice(0, 3);
}

export function makeMessage(s: State): Message {
  const gap = s.sat - s.ret;
  if (isFit(s.vd, s.ret)) {
    const left = WIN_STREAK - s.streak;
    return { cls: 'good', text: `Both fit signals are green. Keep it up for ${left > 0 ? left + ' more month' + (left > 1 ? 's' : '') : '0 more months'}.` };
  }
  if (gap >= POLITE_GAP)
    return { cls: 'warn', text: 'Satisfaction is much higher than retention. Customers are being polite, but they do not come back. Compliments are not fit.' };
  if (s.vd < VD_TARGET && s.ret < RET_TARGET)
    return { cls: 'bad', text: 'Neither fit signal passes yet. Are you solving a problem this segment really has?' };
  return { cls: 'warn', text: 'One fit signal passes, the other does not yet. You are getting closer, or it is a coincidence. Look at the trend.' };
}

export function endState(s: State): Ending | null {
  if (s.streak >= WIN_STREAK) return 'win';
  if (s.cash <= 0) return 'broke';
  if (s.month >= MAX_MONTH) return 'time';
  return null;
}

/** Final score for a win: cash left plus a bonus per unused month. */
export const score = (s: State): number => s.cash + 2000 * (MAX_MONTH - s.month);

/** Debrief lessons (trusted HTML: contains only game content and numbers). */
export function insights(s: State): string[] {
  const H = s.history, L: string[] = [], seg = segmentOf(s);
  if (s.ended === 'win')
    L.push(`You found fit in month ${s.month} with <b>${seg.name}</b> and the features <b>${s.features.map(f => FEATURES[f].name).join(', ')}</b>. That worked because the product solved their real problem.`);
  if (s.ended === 'broke')
    L.push(`You ran out of cash in month ${s.month}. Every month costs ${eur(BURN)}, so a month without learning something is an expensive month.`);
  if (s.ended === 'time')
    L.push('You reached month 12 with cash but no fit. Not finding fit does not mean you failed: now you know which assumptions were wrong.');
  const gapRow = H.reduce<(typeof H)[number] | null>((a, r) => (r.sat - r.ret > (a ? a.sat - a.ret : -1) ? r : a), null);
  if (gapRow && gapRow.sat - gapRow.ret >= POLITE_GAP)
    L.push(`In month ${gapRow.month} satisfaction was ${gapRow.sat}% but only ${gapRow.ret}% were still active. Compliments are not fit. Retention is the signal to trust.`);
  const stuck = H.filter(r => r.ret < RET_TARGET && r.decision === 'Persevere').length;
  if (stuck >= 3)
    L.push(`You persevered ${stuck} times while retention was below 30%. When the evidence does not improve, change something.`);
  if (s.pivots === 0 && s.ended !== 'win' && s.ret < RET_TARGET)
    L.push('You never pivoted. A pivot is expensive, but so is waiting. Next time, try a different customer sooner.');
  if (s.pivots >= 2)
    L.push(`You pivoted ${s.pivots} times. Each pivot restarts your numbers, so give a new direction a few months before judging it.`);
  if (s.interviews === 0)
    L.push('You never interviewed customers. Two interviews cost €4k and tell you the real problem, which is cheaper than building the wrong feature.');
  return L.slice(0, 4);
}
