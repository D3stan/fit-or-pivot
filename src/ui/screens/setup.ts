import { esc } from '../../format';
import { STYLES } from '../../game/content';
import type { State } from '../../game/types';
import { topBar } from '../components/topBar';

export function setup(s: State): string {
  const styles = Object.entries(STYLES).map(([k, st]) => `
    <label class="choice ${s.style === k ? 'sel' : ''}"><input type="radio" name="style" ${s.style === k ? 'checked' : ''} data-a="style" data-v="${k}">
      <span class="t">${st.emoji} ${st.label}</span><span class="d">${st.desc}</span></label>`).join('');
  return `${topBar(s)}
  <div class="card">
    <h2>Create your product</h2>
    <p class="muted">You are building an app that helps people organise their work. Make it yours. Your name and idea will show up in the customer feedback.</p>
    <label class="field" for="name">Product name</label>
    <input id="name" type="text" maxlength="24" placeholder="e.g. Flowly" value="${esc(s.name)}" autocomplete="off">
    <label class="field" for="idea">Your idea in one sentence</label>
    <input id="idea" type="text" maxlength="110" placeholder="What does it do, and for whom?" value="${esc(s.idea)}" autocomplete="off">
    <label class="field">Pick a tone <span class="muted small">(customers have taste, and different customers like different tones)</span></label>
    <div class="grid g3">${styles}</div>
    ${s.setupError ? `<div class="note" role="alert">${esc(s.setupError)}</div>` : ''}
    <div class="row" style="margin-top:18px">
      <button class="btn alt" data-a="surprise">🎲 Surprise me</button>
      <button class="btn right" data-a="setupDone">Next: choose your customer</button>
    </div>
  </div>`;
}
