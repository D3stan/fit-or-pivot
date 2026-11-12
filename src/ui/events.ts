import type { Action } from '../game/actions';
import type { FeatureKey, SegmentKey, StyleKey } from '../game/types';

export type Dispatch = (a: Action, rerender?: boolean) => void;

const val = (id: string) => (document.getElementById(id) as HTMLInputElement | null)?.value ?? '';

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
export function wireEvents(dispatch: Dispatch): void {
  document.addEventListener('click', e => {
    const b = (e.target as Element).closest<HTMLButtonElement>('[data-a]');
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
}
