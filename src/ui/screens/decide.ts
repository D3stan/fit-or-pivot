import { eur } from '../../format';
import { ADD_COST, BURN, INTERVIEW_COST, ITER_COST, MAX_FEATURES, PIVOT_COST } from '../../game/config';
import { STYLES, TESTS } from '../../game/content';
import { segmentOf } from '../../game/engine';
import type { State } from '../../game/types';
import { featureChips } from '../components/chips';
import { kpis } from '../components/kpis';
import { notes } from '../components/notes';
import { optionCard } from '../components/optionCard';
import { topBar } from '../components/topBar';

export function decide(s: State): string {
  const seg = segmentOf(s);
  const left = seg.interview.length - (s.notes[s.segment!] || []).length;
  const full = s.features.length >= MAX_FEATURES;
  return `${topBar(s)}
  <h2>What do you do next?</h2>
  <p class="muted">Persevere, iterate, add a feature, or pivot? Every choice costs money, and every month burns ${eur(BURN)}. Look at the trend before you decide.</p>
  <div class="row" style="margin-bottom:12px"><span class="chip">${seg.emoji} ${seg.name}</span>${featureChips(s.features)}<span class="chip">Tone: ${STYLES[s.style].label}</span></div>
  ${kpis(s)}
  ${notes(s, s.segment)}
  <div class="grid g2" style="margin-top:16px">
    ${optionCard('Persevere', 0, 'Change nothing and see what another month shows. Good when the numbers are improving.', TESTS.persevere, 'persevere', false)}
    ${optionCard('Iterate on the MVP', ITER_COST, 'Swap one feature for another, and/or change the tone.', TESTS.iterate, 'openIterate', s.cash < ITER_COST, 'Not enough cash.')}
    ${optionCard('Add a feature', ADD_COST, 'Expensive. You can have at most 4 features.', TESTS.add, 'openAdd', full || s.cash < ADD_COST, full ? 'You already have 4 features.' : 'Not enough cash.')}
    ${optionCard('Pivot', PIVOT_COST, 'Aim at a different customer and rewrite your idea. Your numbers restart from zero.', TESTS.pivot, 'openPivot', s.cash < PIVOT_COST, 'Not enough cash.')}
  </div>
  <div class="card" style="margin-top:16px"><div class="row"><div><b>Not sure what they need?</b><div class="muted small">Interview ${seg.name.toLowerCase()} to learn more about their real problem.</div><p class="hint" style="margin-bottom:0">${TESTS.interview}</p></div>
    <button class="btn alt right" data-a="interview" data-seg="${s.segment}" ${left <= 0 || s.cash < INTERVIEW_COST ? 'disabled' : ''}>${left <= 0 ? 'No more to learn' : 'Interview ' + '<span class="cost">' + eur(INTERVIEW_COST) + '</span>'}</button></div></div>`;
}
