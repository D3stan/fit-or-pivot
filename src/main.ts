import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { reduce, type Action } from './game/actions';
import { newState } from './game/state';
import { wireEvents } from './ui/events';
import { render } from './ui/render';

const app = document.getElementById('app')!;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let state = newState();

function dispatch(action: Action, rerender = true): void {
  const prev = state;
  state = reduce(state, action, Math.random);
  if (state === prev || !rerender) return;
  render(app, state);
  if (state.screen !== prev.screen) window.scrollTo(0, 0);
  // Brief suspense before results; the month itself was already simulated.
  if (state.screen === 'testing' && prev.screen !== 'testing')
    setTimeout(() => dispatch({ type: 'showResult' }), reducedMotion ? 0 : 1000);
}

wireEvents(dispatch);
render(app, state);
