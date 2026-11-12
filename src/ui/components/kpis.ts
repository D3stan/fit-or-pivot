import { eur } from '../../format';
import { RET_TARGET, VD_TARGET, WIN_STREAK } from '../../game/config';
import { runway } from '../../game/engine';
import type { State } from '../../game/types';

export function delta(cur: number, prev: number, fmt: (d: number) => string = String): string {
  const d = cur - prev;
  if (d === 0) return `<span class="delta flat">no change</span>`;
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲ +' : '▼ '}${fmt(d)}</span>`;
}

export function kpis(s: State): string {
  const p = s.prev || { sat: s.sat, ret: s.ret, vd: s.vd, cash: s.cash };
  return `<div class="grid g5">
    <div class="kpi"><div class="l">Cash left</div><div class="v">${eur(s.cash)}</div><span class="delta flat">${runway(s)} months runway</span></div>
    <div class="kpi"><div class="l">Satisfaction</div><div class="v">${s.sat}%</div>${delta(s.sat, p.sat)}</div>
    <div class="kpi ${s.ret >= RET_TARGET ? 'ok' : ''}"><div class="l">Still active (target ${RET_TARGET}%)</div><div class="v">${s.ret}%</div>${delta(s.ret, p.ret)}</div>
    <div class="kpi ${s.vd >= VD_TARGET ? 'ok' : ''}"><div class="l">Very disappointed without it (target ${VD_TARGET}%)</div><div class="v">${s.vd}%</div>${delta(s.vd, p.vd)}</div>
    <div class="kpi"><div class="l">Fit streak</div><div class="v">${s.streak} / ${WIN_STREAK}</div><span class="delta flat">months in a row</span></div>
  </div>`;
}
