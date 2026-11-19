import type { Action } from '../game/actions';
import type { FeatureKey, SegmentKey, StyleKey } from '../game/types';
import type { TelemetryEventType } from '../shared/telemetry';

export type Dispatch = (a: Action, rerender?: boolean) => void;

export interface TelemetryHooks {
  recordUiEvent?: (eventType: TelemetryEventType, payload?: Record<string, unknown>, durationMs?: number) => void;
  flushBeacon?: () => void;
}

const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';
const trackedInputs = new Set(['name', 'idea', 'pidea']);

/** Turn a `data-a` element into an action; setup actions also read the text fields. */
function toAction(a: string, d: DOMStringMap): Action {
  switch (a) {
    case 'style': return { type: 'style', style: d.v as StyleKey, name: val('name'), idea: val('idea') };
    case 'setupDone': return { type: 'setupDone', name: val('name'), idea: val('idea') };
    case 'interview': case 'choose': return { type: a, seg: d.seg as SegmentKey };
    case 'feat': return { type: 'feat', f: d.f as FeatureKey };
    default: return { type: a } as Action; // unknown names fall through the reducer unchanged
  }
}

/** Delegated listeners: `data-a` = action on click, `data-m` = modal field on change/input. */
export function wireEvents(dispatch: Dispatch, hooks?: TelemetryHooks): void {
  const focusState = new Map<string, { value: string; at: number }>();

  document.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const disabledBtn = document.elementsFromPoint(e.clientX, e.clientY)
      .find((el): el is HTMLElement => el.matches('[data-a]:disabled'));
    if (!disabledBtn) return;
    const payload: Record<string, unknown> = { action: disabledBtn.dataset.a };
    if (disabledBtn.dataset.seg) payload.seg = disabledBtn.dataset.seg;
    if (disabledBtn.dataset.f) payload.f = disabledBtn.dataset.f;
    hooks?.recordUiEvent?.('ui.disabled_click', payload);
  });

  document.addEventListener('click', e => {
    const target = e.target as Element | null;
    if (!target) return;
    if (target.classList.contains('overlay')) {
      hooks?.recordUiEvent?.('ui.backdrop_click');
      return;
    }
    const b = target.closest<HTMLButtonElement>('[data-a]');
    if (!b || b.disabled) return;
    dispatch(toAction(b.dataset.a!, b.dataset));
  });

  document.addEventListener('change', e => {
    const t = e.target as HTMLInputElement;
    const k = t.dataset?.m;
    if (k) dispatch({ type: 'modalField', key: k, value: t.value });
  });

  document.addEventListener('input', e => {
    const t = e.target as HTMLInputElement;
    // Keep typing smooth: store the pivot idea without re-rendering (and losing the caret).
    if (t.dataset?.m === 'idea') dispatch({ type: 'modalField', key: 'idea', value: t.value }, false);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') dispatch({ type: 'close' });
  });

  document.addEventListener('focusin', e => {
    const el = e.target as HTMLInputElement | null;
    if (!el || !trackedInputs.has(el.id)) return;
    focusState.set(el.id, { value: el.value, at: Date.now() });
  });

  document.addEventListener('focusout', e => {
    const el = e.target as HTMLInputElement | null;
    if (!el || !trackedInputs.has(el.id)) return;
    const prev = focusState.get(el.id);
    focusState.delete(el.id);
    if (!prev || el.value === prev.value) return;
    hooks?.recordUiEvent?.('ui.input_blur', {
      fieldId: el.id,
      value: el.value,
      length: el.value.length,
      prevLength: prev.value.length,
      editDurationMs: Math.max(0, Date.now() - prev.at),
    });
  });

  document.addEventListener('visibilitychange', () => {
    hooks?.recordUiEvent?.('page.visibility', { state: document.visibilityState });
    if (document.visibilityState === 'hidden') {
      hooks?.flushBeacon?.();
    }
  });

  window.addEventListener('pagehide', () => {
    hooks?.flushBeacon?.();
  });
}
