import { MAX_MONTH, RET_TARGET, VD_TARGET } from '../../game/config';
import type { HistoryRow } from '../../game/types';

type Metric = 'sat' | 'vd' | 'ret';

/** SVG line chart of the fit signals over the months played, plus legend. */
export function chart(H: HistoryRow[]): string {
  const W = 600, Ht = 230, x0 = 40, x1 = 570, yb = 195, yt = 15;
  const X = (m: number) => x0 + (m - 1) * (x1 - x0) / (MAX_MONTH - 1);
  const Y = (v: number) => yb - v * (yb - yt) / 100;
  const line = (key: Metric, color: string, dash = false) => {
    if (!H.length) return '';
    const pts = H.map(r => `${X(r.month).toFixed(1)},${Y(r[key]).toFixed(1)}`).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="4" stroke-linejoin="round" ${dash ? 'stroke-dasharray="2 5" stroke-linecap="round"' : ''}/>` +
      (dash ? '' : H.map(r => `<circle cx="${X(r.month).toFixed(1)}" cy="${Y(r[key]).toFixed(1)}" r="4" fill="${color}"/>`).join(''));
  };
  const grid = [0, 25, 50, 75, 100].map(v => `<line x1="${x0}" x2="${x1}" y1="${Y(v)}" y2="${Y(v)}" stroke="#cdbf9c"/><text x="${x0 - 6}" y="${Y(v) + 4}" text-anchor="end" font-size="11" fill="#5d5446">${v}%</text>`).join('');
  const xl = Array.from({ length: MAX_MONTH }, (_, i) => `<text x="${X(i + 1)}" y="${yb + 16}" text-anchor="middle" font-size="11" fill="#5d5446">${i + 1}</text>`).join('');
  const piv = H.filter(r => r.decision === 'Pivot').map(r =>
    `<line x1="${X(r.month)}" x2="${X(r.month)}" y1="${yt}" y2="${yb}" stroke="#1d1a16" stroke-dasharray="4 4"/><text x="${X(r.month) + 3}" y="${yt + 10}" font-size="11" fill="#2b5fa8">pivot</text>`).join('');
  const th = `<line x1="${x0}" x2="${x1}" y1="${Y(VD_TARGET)}" y2="${Y(VD_TARGET)}" stroke="#d9412b" stroke-dasharray="6 4"/><text x="${x1 + 3}" y="${Y(VD_TARGET) + 4}" font-size="10" fill="#d9412b">${VD_TARGET}%</text>
              <line x1="${x0}" x2="${x1}" y1="${Y(RET_TARGET)}" y2="${Y(RET_TARGET)}" stroke="#2b5fa8" stroke-dasharray="6 4"/><text x="${x1 + 3}" y="${Y(RET_TARGET) + 4}" font-size="10" fill="#2b5fa8">${RET_TARGET}%</text>`;
  const last = H[H.length - 1];
  return `<svg viewBox="0 0 ${W} ${Ht}" width="100%" role="img" aria-label="Chart over time. Latest: still active ${last ? last.ret : 0} percent, very disappointed ${last ? last.vd : 0} percent, satisfaction ${last ? last.sat : 0} percent.">
    ${grid}${xl}${piv}${th}${line('sat', '#8a7f6a', true)}${line('vd', '#d9412b')}${line('ret', '#2b5fa8')}
    <text x="${(x0 + x1) / 2}" y="${Ht - 3}" text-anchor="middle" font-size="11" fill="#5d5446">Month</text></svg>
    <div class="chips" style="margin-top:4px">
      <span class="chip" style="color:#2b5fa8">━ Still active</span>
      <span class="chip" style="color:#d9412b">━ Very disappointed</span>
      <span class="chip" style="color:#5d5446">··· Satisfaction (compliments)</span></div>`;
}
