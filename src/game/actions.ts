// Player actions -> next state. Returns the same object when nothing changes,
// so the caller can skip re-rendering.
import {
  ADD_COST, FEATURE_COST, INTERVIEW_COST, ITER_COST, MVP_FEATURES, PIVOT_COST, PIVOT_START,
} from './config';
import { SEGMENTS, SURPRISE } from './content';
import { endState, makeImpact, runMonth } from './engine';
import { newState } from './state';
import type { Decision, FeatureKey, Modal, Rng, SegmentKey, State, StyleKey } from './types';

export type Action =
  | { type: 'start' | 'surprise' | 'launch' | 'next' | 'persevere' | 'showResult' | 'restart' }
  | { type: 'openIterate' | 'openAdd' | 'openPivot' | 'help' | 'close' }
  | { type: 'confirmIterate' | 'confirmAdd' | 'confirmPivot' }
  | { type: 'style'; style: StyleKey; name: string; idea: string }
  | { type: 'setupDone'; name: string; idea: string }
  | { type: 'interview' | 'choose'; seg: SegmentKey }
  | { type: 'feat'; f: FeatureKey }
  | { type: 'modalField'; key: string; value: string };

/** Pay for a change, then simulate the month; the UI shows 'testing' before 'result'.
 *  `before` is the state when the player made the decision, `changed` has the change applied. */
function startTest(before: State, changed: State, decision: Decision, cost: number, rng: Rng): State {
  const next = runMonth({ ...changed, cash: changed.cash - cost }, decision, rng);
  return { ...next, screen: 'testing', interviewSpend: 0, impact: makeImpact(before, next, decision, cost) };
}

function interview(s: State, segKey: SegmentKey): State {
  if (s.cash < INTERVIEW_COST) return s;
  const seg = SEGMENTS[segKey], notes = s.notes[segKey] || [];
  if (notes.length >= seg.interview.length) return s;
  return {
    ...s,
    cash: s.cash - INTERVIEW_COST,
    interviewSpend: s.interviewSpend + INTERVIEW_COST,
    interviews: s.interviews + 1,
    notes: { ...s.notes, [segKey]: [...notes, seg.interview[notes.length]] },
  };
}

export function reduce(s: State, a: Action, rng: Rng): State {
  const m = s.modal;
  switch (a.type) {
    case 'start': return { ...s, screen: 'setup' };
    case 'surprise': {
      const r = SURPRISE[Math.floor(rng() * SURPRISE.length)];
      return { ...s, name: r.name, idea: r.idea };
    }
    case 'style': return { ...s, name: a.name, idea: a.idea, style: a.style };
    case 'setupDone': {
      const name = a.name.trim(), idea = a.idea.trim();
      if (!name) return { ...s, name, idea, setupError: 'Give your product a name first (or press “Surprise me”).' };
      return { ...s, name, idea, setupError: '', screen: 'customer' };
    }
    case 'interview': return interview(s, a.seg);
    case 'choose': return { ...s, segment: a.seg, screen: 'build' };
    case 'feat': {
      if (s.pick.includes(a.f)) return { ...s, pick: s.pick.filter(f => f !== a.f) };
      return s.pick.length < MVP_FEATURES ? { ...s, pick: [...s.pick, a.f] } : { ...s };
    }
    case 'launch':
      if (s.pick.length !== MVP_FEATURES) return s;
      return startTest(s, { ...s, features: [...s.pick] }, 'Launch MVP', FEATURE_COST * MVP_FEATURES, rng);
    case 'showResult': return { ...s, screen: 'result' };
    case 'next': {
      const e = endState(s);
      return e ? { ...s, ended: e, screen: 'end' } : { ...s, screen: 'decide' };
    }
    case 'persevere': return startTest(s, s, 'Persevere', 0, rng);
    case 'openIterate': return { ...s, modal: { type: 'iterate', remove: '', add: '', style: s.style } };
    case 'openAdd': return { ...s, modal: { type: 'add', add: '' } };
    case 'openPivot': return { ...s, modal: { type: 'pivot', seg: '', idea: s.idea, style: s.style } };
    case 'help': return { ...s, modal: { type: 'help' } };
    case 'close': return m ? { ...s, modal: null } : s;
    case 'modalField':
      // Values come from options the UI rendered for this modal.
      return m ? { ...s, modal: { ...m, [a.key]: a.value } as Modal } : s;
    case 'confirmIterate': {
      if (m?.type !== 'iterate') return s;
      const features = m.remove && m.add ? s.features.filter(f => f !== m.remove).concat(m.add) : s.features;
      return startTest(s, { ...s, modal: null, features, style: m.style }, 'Iterate', ITER_COST, rng);
    }
    case 'confirmAdd': {
      if (m?.type !== 'add' || !m.add) return s;
      return startTest(s, { ...s, modal: null, features: [...s.features, m.add] }, 'Add a feature', ADD_COST, rng);
    }
    case 'confirmPivot': {
      if (m?.type !== 'pivot' || !m.seg) return s;
      return startTest(s, {
        ...s, modal: null, segment: m.seg, idea: m.idea.trim(), style: m.style, pivots: s.pivots + 1,
        ...PIVOT_START, streak: 0,
      }, 'Pivot', PIVOT_COST, rng);
    }
    case 'restart': return newState();
  }
}
