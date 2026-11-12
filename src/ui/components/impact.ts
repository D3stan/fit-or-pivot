import { esc, eur } from '../../format';
import { RET_TARGET, VD_TARGET, WIN_STREAK } from '../../game/config';
import type { State } from '../../game/types';
import { delta } from './kpis';

const pct = (n: number) => `${n}%`;

function tile(label: string, before: number, after: number, money: boolean, ok = false): string {
  const fmt = money ? eur : pct;
  return `<div class="kpi${ok ? ' ok' : ''}"><div class="l">${label}</div>
    <div class="v"><span class="was">${fmt(before)}</span> <span aria-hidden="true">→</span><span class="sr"> now </span>${fmt(after)}</div>${delta(after, before, money ? eur : String)}</div>`;
}

/** Result screen: what the decision did this month, before → after, and where the cash went. */
export function impact(s: State): string {
  const im = s.impact!, b = im.before, a = im.after;
  const spent = im.costs.reduce((t, c) => t + c.amount, 0);
  const costs = im.costs.map(c => `<span class="chip">${c.label} <span class="cost">${c.amount ? eur(c.amount) : 'free'}</span></span>`).join('');
  return `<section class="card impact" aria-labelledby="impact-h">
    <h3 id="impact-h">What your decision did</h3>
    <p class="link">${esc(im.link)}</p>
    <div class="grid g4">
      ${tile('Cash', b.cash, a.cash, true)}
      ${tile('Satisfaction', b.sat, a.sat, false)}
      ${tile(`Still active (target ${RET_TARGET}%)`, b.ret, a.ret, false, a.ret >= RET_TARGET)}
      ${tile(`Very disappointed without it (target ${VD_TARGET}%)`, b.vd, a.vd, false, a.vd >= VD_TARGET)}
    </div>
    <div class="row spend"><span class="muted">Where the money went:</span>${costs}<b>= ${eur(-spent)}</b>
      <span class="chip right">Fit streak <b>${s.streak} / ${WIN_STREAK}</b> months in a row</span></div>
  </section>`;
}
