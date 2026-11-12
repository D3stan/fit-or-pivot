import { esc } from '../../format';
import { STYLES } from '../../game/content';
import { endState, segmentOf } from '../../game/engine';
import type { State } from '../../game/types';
import { chart } from '../components/chart';
import { featureChips } from '../components/chips';
import { impact } from '../components/impact';
import { notes } from '../components/notes';
import { topBar } from '../components/topBar';

export function result(s: State): string {
  const seg = segmentOf(s), e = endState(s), m = s.msg!;
  return `${topBar(s)}
  <h2>Month ${s.month} results</h2>
  <p class="muted"><b>${s.lastDecision}</b> · Customer: ${seg.emoji} ${seg.name} · Tone: ${STYLES[s.style].label}</p>
  <div class="chips" style="margin-bottom:12px">${featureChips(s.features)}</div>
  <div class="banner ${m.cls}" role="status">${m.text}</div>
  ${impact(s)}
  <div class="grid g2" style="margin-top:16px">
    <div class="card" style="margin:0"><h3>What customers said</h3>
      ${s.quotes.map(q => `<div class="quote">${esc(q)}</div>`).join('')}
      <p class="small muted">Look for what customers <i>do</i>, not just what they say.</p></div>
    <div class="card" style="margin:0"><h3>The trend so far</h3>${chart(s.history)}</div>
  </div>
  ${notes(s, s.segment)}
  <div class="row" style="margin-top:16px"><button class="btn big right" data-a="next">${e ? 'See the ending' : 'Decide the next step'}</button></div>`;
}
