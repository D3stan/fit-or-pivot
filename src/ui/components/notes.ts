import type { SegmentKey, State } from '../../game/types';

/** Sticky note with the interview answers collected for a segment. */
export function notes(s: State, segKey: SegmentKey | null): string {
  const n = (segKey && s.notes[segKey]) || [];
  if (!n.length) return '';
  return `<div class="note"><b>Interview notes</b>${n.map(t => `<div>${t}</div>`).join('')}</div>`;
}
