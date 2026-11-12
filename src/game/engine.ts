// Pure game rules. No DOM, no timers; randomness is injected as `rng`.
import { clamp, eur } from '../format';
import { BURN, MAX_MONTH, PIVOT_START, POLITE_GAP, RET_TARGET, VD_TARGET, WIN_STREAK } from './config';
import { FEATURES, SEGMENTS, STYLES } from './content';
import type { Decision, Ending, FeatureKey, Impact, Message, Metrics, Rng, Segment, SegmentKey, State } from './types';

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

const metrics = (s: State): Metrics => ({ cash: s.cash, sat: s.sat, ret: s.ret, vd: s.vd });

/** Before/after of one month. `before` is the state when the decision was made, `after` the simulated month. */
export function makeImpact(before: State, after: State, decision: Decision, cost: number): Impact {
  const costs = [{ label: decision as string, amount: cost }];
  if (before.interviewSpend) costs.push({ label: 'Interviews', amount: before.interviewSpend });
  costs.push({ label: 'Monthly burn', amount: BURN });
  return {
    // Interviews already left the cash pile, so add them back: "before" is where the month started.
    before: { ...metrics(before), cash: before.cash + before.interviewSpend },
    after: metrics(after),
    costs,
    link: linkSentence(decision, before, after),
  };
}

/** Changes within the monthly jitter (±2) count as "flat". */
const NOISE = 2;

/** One plain-text sentence connecting the decision to what moved. Never names the hidden weights. */
export function linkSentence(decision: Decision, before: State, after: State): string {
  const seg = segmentOf(after).name.toLowerCase();
  const name = (f: FeatureKey) => FEATURES[f].name;
  const base = decision === 'Pivot' ? PIVOT_START.ret : before.ret;
  const d = after.ret - base;
  const dir = d > NOISE ? 'up' : d < -NOISE ? 'down' : 'flat';
  const moved = dir === 'up' ? `retention rose ${d} points`
    : dir === 'down' ? `retention fell ${-d} points`
    : d === 0 ? 'retention did not move' : `retention barely moved (${d > 0 ? '+' : ''}${d})`;
  const pick = (up: string, flat: string, down: string) => ({ up, flat, down })[dir];
  // Satisfaction up without retention: people are being nice, not coming back.
  const polite = after.sat - before.sat > NOISE && dir !== 'up';
  const politeEnd = ': satisfaction rose but retention didn’t — compliments, not fit.';
  // Retention keeps drifting toward last month's target; don't credit a change that added nothing.
  const coasting = dir === 'up' && after.segment === before.segment
    && needScore(after.segment!, after.features) <= needScore(after.segment!, before.features);
  const coastEnd = (what: string) => `: ${moved}, but that is the earlier trend — ${what} didn’t drive it.`;

  switch (decision) {
    case 'Persevere':
      return `You persevered: ${moved} — ${pick('the trend kept going on its own.', 'waiting alone isn’t fixing it.', 'waiting is costing you.')}`;
    case 'Pivot':
      return `You pivoted to ${seg}: numbers restarted and ${pick(
        `retention already climbed to ${after.ret}% — watch the next two months.`,
        `retention sits at ${after.ret}% — watch the next two months before judging.`,
        `retention slipped to ${after.ret}% — give it two months, then judge.`)}`;
    case 'Launch MVP': {
      const did = `You launched ${after.features.map(name).join(' and ')} for ${seg}`;
      if (polite) return did + politeEnd;
      return `${did}: ${moved} — ${pick('a real first signal.', 'this pair isn’t pulling people back yet.', 'they aren’t coming back for this.')}`;
    }
    case 'Add a feature': {
      const did = `You added ${after.features.filter(f => !before.features.includes(f)).map(name).join(' and ')}`;
      if (polite) return did + politeEnd;
      if (coasting) return did + coastEnd('the new feature');
      return `${did}: ${moved} — ${pick('this time more product did help.', 'more product didn’t create more value.', 'more product made it worse.')}`;
    }
    case 'Iterate': {
      const removed = before.features.filter(f => !after.features.includes(f)).map(name).join(', ');
      const added = after.features.filter(f => !before.features.includes(f)).map(name).join(', ');
      const tone = after.style !== before.style ? STYLES[after.style].label.toLowerCase() : '';
      const swap = !!(removed && added);
      const did = swap ? `You swapped ${removed} for ${added}${tone ? ` and went ${tone}` : ''}`
        : tone ? `You switched to a ${tone} tone` : 'You iterated';
      if (polite) return did + politeEnd;
      if (swap && coasting) return did + coastEnd('the swap');
      if (swap) return `${did}: ${moved} — ${pick(`that change mattered to ${seg}.`, `that swap didn’t change much for ${seg}.`, `${seg} miss what you took out.`)}`;
      return `${did}: ${moved} — ${pick(`it suits ${seg} better.`, 'tone alone won’t fix the product.', `${seg} liked the old tone better.`)}`;
    }
  }
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
