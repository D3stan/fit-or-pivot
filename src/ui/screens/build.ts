import { eur } from '../../format';
import { FEATURE_COST, MVP_FEATURES } from '../../game/config';
import { FEATURES, TESTS } from '../../game/content';
import { segmentOf } from '../../game/engine';
import type { FeatureKey, State } from '../../game/types';
import { notes } from '../components/notes';
import { topBar } from '../components/topBar';

export function build(s: State): string {
  const seg = segmentOf(s);
  const cards = (Object.keys(FEATURES) as FeatureKey[]).map(k => {
    const f = FEATURES[k], on = s.pick.includes(k);
    return `<button type="button" class="choice ${on ? 'sel' : ''}" data-a="feat" data-f="${k}" aria-pressed="${on}" style="text-align:left;font:inherit">
      <span class="t">${f.icon} ${f.name}${on ? ' ✓' : ''}<span class="cost">${eur(FEATURE_COST)}</span></span><span class="d">${f.desc}</span><span class="hint">${f.test}</span></button>`;
  }).join('');
  return `${topBar(s)}
  <h2>Build your MVP</h2>
  <p class="muted">An MVP is the smallest product you can test. Your customer: <b>${seg.emoji} ${seg.name}</b>. Choose <b>exactly 2 features</b>. Each costs ${eur(FEATURE_COST)}.</p>
  ${notes(s, s.segment)}
  <div class="grid g3" style="margin:14px 0">${cards}</div>
  <div class="row">
    <span class="pill">${s.pick.length} of 2 chosen · cost ${eur(s.pick.length * FEATURE_COST)}</span>
    <button class="btn right" data-a="launch" ${s.pick.length === MVP_FEATURES ? '' : 'disabled'}>Launch and test with customers <span class="cost">${eur(FEATURE_COST * MVP_FEATURES)}</span></button>
  </div>
  <p class="hint">${TESTS.launch}</p>`;
}
