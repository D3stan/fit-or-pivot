import { eur } from '../../format';

/** A decision option: title with cost badge, description and a Choose button. */
export function optionCard(title: string, cost: number, desc: string, action: string, disabled: boolean, why = ''): string {
  return `<div class="card opt" style="margin:0"><h3>${title}${cost ? `<span class="cost">${eur(cost)}</span>` : '<span class="cost">free</span>'}</h3>
    <p class="muted">${desc}</p>
    <button class="btn" data-a="${action}" ${disabled ? 'disabled' : ''}>Choose</button>
    ${disabled && why ? `<div class="small muted" style="margin-top:6px">${why}</div>` : ''}</div>`;
}
