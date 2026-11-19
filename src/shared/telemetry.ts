import type { Decision, Ending, FeatureKey, Modal, Screen, SegmentKey, State, StyleKey } from '../game/types.js';

export type TelemetryEventType =
  | 'session.start'
  | 'run.start'
  | 'action.dispatched'
  | 'month.simulated'
  | 'ui.disabled_click'
  | 'ui.modal_cancelled'
  | 'ui.input_blur'
  | 'ui.backdrop_click'
  | 'page.visibility'
  | 'client.error';

export interface SessionMeta {
  viewportW: number;
  viewportH: number;
  reducedMotion: boolean;
  referrer: string;
  locale: string;
  timezone: string;
}

export interface StateSummary {
  screen: Screen;
  month: number;
  cash: number;
  name: string;
  idea: string;
  style: StyleKey;
  segment: SegmentKey | null;
  features: FeatureKey[];
  sat: number;
  ret: number;
  vd: number;
  streak: number;
  pivots: number;
  interviews: number;
  modalType: Modal['type'] | null;
  ended: Ending | null;
  lastDecision: Decision | '';
  pick: FeatureKey[];
  setupError: string;
}

export interface TelemetryEvent {
  seq: number;
  ts: number;
  sessionId: string;
  runId: string;
  eventType: TelemetryEventType;
  actionType?: string;
  screenFrom?: Screen;
  screenTo?: Screen;
  durationMs?: number;
  payload?: Record<string, unknown>;
  state?: StateSummary;
}

export interface TelemetryBatch {
  sessionId: string;
  meta?: SessionMeta;
  events: TelemetryEvent[];
}

export function summarizeState(s: State): StateSummary {
  return {
    screen: s.screen,
    month: s.month,
    cash: s.cash,
    name: s.name,
    idea: s.idea,
    style: s.style,
    segment: s.segment,
    features: [...s.features],
    sat: s.sat,
    ret: s.ret,
    vd: s.vd,
    streak: s.streak,
    pivots: s.pivots,
    interviews: s.interviews,
    modalType: s.modal?.type ?? null,
    ended: s.ended,
    lastDecision: s.lastDecision,
    pick: [...s.pick],
    setupError: s.setupError,
  };
}
