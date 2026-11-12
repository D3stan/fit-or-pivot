import { eur } from '../../format';
import { FEATURES, SEGMENTS, STYLES } from '../../game/content';
import { insights, score } from '../../game/engine';
import type { Ending, State } from '../../game/types';
import { chart } from '../components/chart';
import { topBar } from '../components/topBar';

const ENDINGS: Record<Ending, { cls: string; h: string; p: string }> = {
  win: { cls: 'good', h: '🎉 Product-market fit!', p: 'You passed the fit test 3 months in a row.' },
  broke: { cls: 'bad', h: '💸 Out of cash', p: 'Your runway hit zero before you found fit.' },
  time: { cls: 'warn', h: '⏳ Time is up', p: 'Month 12 and still no fit. You are alive, but not there yet.' },
};

export function end(s: State): string {
  const e = s.ended!, T = ENDINGS[e];
  const sc = e === 'win' ? score(s) : null;
  const tried = [...new Set(s.history.map(r => r.segment))];
  const rows = s.history.map(r => `<tr><td>${r.month}</td><td>${r.decision}</td><td>${SEGMENTS[r.segment].name}</td><td>${r.sat}%</td><td>${r.ret}%</td><td>${r.vd}%</td><td>${eur(r.cash)}</td></tr>`).join('');
  return `${topBar(s)}
  <div class="banner ${T.cls}" style="font-size:1.1rem"><div style="font-size:1.5rem">${T.h}</div>${T.p}${sc !== null ? `<div style="margin-top:6px">Score: <b>€${sc.toLocaleString('en-GB')}</b> (cash left + a bonus for each month you saved)</div>` : ''}</div>
  <div class="card"><h3>Debrief: what customers really needed</h3>
    ${tried.map(k => {
      const g = SEGMENTS[k], p = FEATURES[g.primary], q = FEATURES[g.secondary];
      return `<p><b>${g.emoji} ${g.name}</b> needed: ${g.hidden}<br>
      <span class="muted">Best features: ${p.icon} ${p.name} and ${q.icon} ${q.name}. Preferred tone: ${STYLES[g.style].label}.</span></p>`;
    }).join('')}
    <p class="muted small">“Polished design” never solved a problem for anyone. It only made people say nice things.</p></div>
  <div class="card"><h3>What your decisions taught you</h3><ul>${insights(s).map(t => `<li>${t}</li>`).join('')}</ul></div>
  <div class="card"><h3>Your journey</h3>${chart(s.history)}
    <div class="scroll" style="margin-top:10px"><table><thead><tr><th>Month</th><th>Decision</th><th>Customer</th><th>Satisfied</th><th>Active</th><th>Very disapp.</th><th>Cash</th></tr></thead><tbody>${rows}</tbody></table></div></div>
  <div class="card"><h3>Questions for the tester</h3><ol>
    <li>Was the choice between persevere, iterate and pivot clear and fair?</li>
    <li>Did the budget pressure motivate you without frustrating you?</li>
    <li>Is twelve rounds the right length?</li></ol>
    <p class="muted small">Please send your answers to the team. Thank you!</p></div>
  <div class="row"><button class="btn big" data-a="restart">Play again</button></div>`;
}
