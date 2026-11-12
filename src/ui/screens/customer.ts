import { eur } from '../../format';
import { INTERVIEW_COST } from '../../game/config';
import { SEGMENTS, TESTS } from '../../game/content';
import type { SegmentKey, State } from '../../game/types';
import { notes } from '../components/notes';
import { topBar } from '../components/topBar';

export function customer(s: State): string {
  const cards = (Object.keys(SEGMENTS) as SegmentKey[]).map(k => {
    const g = SEGMENTS[k];
    const left = g.interview.length - (s.notes[k] || []).length;
    return `<div class="card seg" style="margin:0">
      <div class="emoji">${g.emoji}</div><h3>${g.name}</h3>
      <p class="muted">${g.surface}</p>
      ${notes(s, k)}
      <p class="hint">${TESTS.interview}</p>
      <div class="row">
        <button class="btn alt" data-a="interview" data-seg="${k}" ${left <= 0 || s.cash < INTERVIEW_COST ? 'disabled' : ''}>Interview <span class="cost">${eur(INTERVIEW_COST)}</span></button>
        <button class="btn" data-a="choose" data-seg="${k}">Choose</button>
      </div></div>`;
  }).join('');
  return `${topBar(s)}
  <h2>Who is your customer?</h2>
  <p class="muted">Customers say one thing and need another. An interview costs money, but it can show what they actually need. Pick one segment to build for.</p>
  <div class="grid g3">${cards}</div>`;
}
