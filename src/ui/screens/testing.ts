import { esc } from '../../format';
import type { State } from '../../game/types';
import { topBar } from '../components/topBar';

export function testing(s: State): string {
  return `${topBar(s)}<div class="card center" style="padding:48px 20px">
    <div class="spinner" aria-hidden="true"></div>
    <h2>Rolling the dice…</h2><p class="muted">Real customers are trying ${esc(s.name || 'Your app')}.</p></div>`;
}
