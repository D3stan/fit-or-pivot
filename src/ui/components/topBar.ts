import { esc, eur } from '../../format';
import { BURN, LOW_CASH, MAX_MONTH } from '../../game/config';
import { runway } from '../../game/engine';
import type { Screen, State } from '../../game/types';

const STEPS = ['Customer', 'Build', 'Test', 'Feedback', 'Decide'];
const STEP_OF: Partial<Record<Screen, number>> = { customer: 1, build: 2, testing: 3, result: 4, decide: 5 };

export function topBar(s: State): string {
  if (s.screen === 'intro') return '';
  const pct = Math.round(s.month / MAX_MONTH * 100);
  const bad = s.cash <= LOW_CASH ? ' bad' : '';
  const step = STEP_OF[s.screen] || 0;
  const steps = step ? `<ol class="steps" aria-label="The loop">${STEPS.map((t, i) =>
      `<li class="${i + 1 === step ? 'on' : (i + 1 < step ? 'done' : '')}">${i + 1}. ${t}</li>`).join('')}</ol>` : '';
  return `<div class="top">
    <div class="top-row">
      <div class="brand">Fit or Pivot${s.name ? `<span>${esc(s.name)}</span>` : ''}</div>
      <div class="pills">
        <span class="pill">💰 ${eur(s.cash)}</span>
        <span class="pill${bad}">⏳ ${runway(s)} mo left</span>
        <button class="linkbtn" data-a="help">How to play</button>
      </div>
    </div>
    <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="${MAX_MONTH}" aria-valuenow="${s.month}" aria-label="Month"><i style="width:${pct}%"></i></div>
    <div class="bar-label"><span>${s.month === 0 ? 'Set-up' : 'Month ' + s.month + ' of ' + MAX_MONTH}</span><span>Burn: ${eur(BURN)} per month</span></div>
  </div>${steps}`;
}
