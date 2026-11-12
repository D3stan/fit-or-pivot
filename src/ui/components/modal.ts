import { esc, eur } from '../../format';
import { ADD_COST, ITER_COST, PIVOT_COST } from '../../game/config';
import { FEATURES, SEGMENTS, STYLES } from '../../game/content';
import type { FeatureKey, Modal, SegmentKey, State, StyleKey } from '../../game/types';

const featureKeys = Object.keys(FEATURES) as FeatureKey[];
const styleEntries = Object.entries(STYLES) as [StyleKey, (typeof STYLES)[StyleKey]][];

/** Tone picker as radio cards; `data-m` names the modal field the change event updates. */
const tonePicker = (name: string, selected: StyleKey) => styleEntries.map(([k, s]) =>
  `<label class="choice ${selected === k ? 'sel' : ''}"><input type="radio" name="${name}" data-m="style" value="${k}" ${selected === k ? 'checked' : ''}><span class="t">${s.emoji} ${s.label}</span></label>`).join('');

function help(): string {
  return `<h2>How to play</h2>
      <p>You are a startup founder. Find a customer who truly needs your app before the cash runs out.</p>
      <ol><li><b>Choose a customer</b> and <b>build an MVP</b> with 2 features.</li>
      <li>Each month customers <b>test</b> it and you read the <b>feedback</b>.</li>
      <li><b>Decide</b>: persevere, iterate, add a feature or pivot.</li></ol>
      <p><b>Win:</b> 40% of users “very disappointed” without your app <i>and</i> 30% still active, 3 months in a row.<br>
      <b>Lose:</b> cash hits €0, or month 12 passes without fit. Either way you get a debrief.</p>
      <div class="row"><button class="btn right" data-a="close">Got it</button></div>`;
}

function iterate(s: State, m: Extract<Modal, { type: 'iterate' }>): string {
  const cur = s.features.map(f => `<option value="${f}" ${m.remove === f ? 'selected' : ''}>${FEATURES[f].name}</option>`).join('');
  const rest = featureKeys.filter(f => !s.features.includes(f)).map(f => `<option value="${f}" ${m.add === f ? 'selected' : ''}>${FEATURES[f].name}</option>`).join('');
  const half = (m.remove && !m.add) || (!m.remove && m.add);
  const ok = (m.remove && m.add) || m.style !== s.style;
  return `<h2>Iterate on the MVP <span class="cost">${eur(ITER_COST)}</span></h2>
      <p class="muted">Swap one feature and/or change the tone.</p>
      <label class="field" for="rm">Remove</label><select id="rm" data-m="remove"><option value="">(keep all)</option>${cur}</select>
      <label class="field" for="ad">Replace with</label><select id="ad" data-m="add"><option value="">(nothing)</option>${rest}</select>
      <label class="field">Tone</label><div class="grid g3">${tonePicker('mstyle', m.style)}</div>
      ${half ? '<div class="note">Choose both a feature to remove and one to add.</div>' : ''}
      <div class="row" style="margin-top:16px"><button class="btn alt" data-a="close">Cancel</button>
      <button class="btn right" data-a="confirmIterate" ${ok && !half ? '' : 'disabled'}>Iterate and test</button></div>`;
}

function add(s: State, m: Extract<Modal, { type: 'add' }>): string {
  const opts = featureKeys.filter(f => !s.features.includes(f)).map(f => `<label class="choice ${m.add === f ? 'sel' : ''}" style="margin-bottom:8px"><input type="radio" name="addf" data-m="add" value="${f}" ${m.add === f ? 'checked' : ''}><span class="t">${FEATURES[f].icon} ${FEATURES[f].name}</span><span class="d">${FEATURES[f].desc}</span></label>`).join('');
  return `<h2>Add a feature <span class="cost">${eur(ADD_COST)}</span></h2>${opts}
      <div class="row" style="margin-top:12px"><button class="btn alt" data-a="close">Cancel</button><button class="btn right" data-a="confirmAdd" ${m.add ? '' : 'disabled'}>Add and test</button></div>`;
}

function pivot(s: State, m: Extract<Modal, { type: 'pivot' }>): string {
  const segs = (Object.entries(SEGMENTS) as [SegmentKey, (typeof SEGMENTS)[SegmentKey]][]).filter(([k]) => k !== s.segment).map(([k, g]) => `<label class="choice ${m.seg === k ? 'sel' : ''}" style="margin-bottom:8px"><input type="radio" name="pseg" data-m="seg" value="${k}" ${m.seg === k ? 'checked' : ''}><span class="t">${g.emoji} ${g.name}</span><span class="d">${g.surface}</span>${(s.notes[k] || []).map(t => `<span class="d" style="color:var(--ink)">${t}</span>`).join('')}</label>`).join('');
  return `<h2>Pivot <span class="cost">${eur(PIVOT_COST)}</span></h2>
      <p class="muted">Pick a new customer. Your numbers restart, but you keep your features.</p>${segs}
      <label class="field" for="pidea">Rewrite your idea</label><input id="pidea" type="text" maxlength="110" data-m="idea" value="${esc(m.idea)}">
      <label class="field">Tone</label><div class="grid g3">${tonePicker('pstyle', m.style)}</div>
      <div class="row" style="margin-top:16px"><button class="btn alt" data-a="close">Cancel</button><button class="btn right" data-a="confirmPivot" ${m.seg ? '' : 'disabled'}>Pivot and test</button></div>`;
}

export function modal(s: State): string {
  const m = s.modal;
  if (!m) return '';
  const body = m.type === 'help' ? help()
    : m.type === 'iterate' ? iterate(s, m)
    : m.type === 'add' ? add(s, m)
    : pivot(s, m);
  return `<div class="overlay" role="dialog" aria-modal="true"><div class="modal">${body}</div></div>`;
}
