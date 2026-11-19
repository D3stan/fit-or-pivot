import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import { reduce, type Action } from './game/actions';
import { newState } from './game/state';
import { telemetry } from './telemetry/client';
import { wireEvents } from './ui/events';
import { render } from './ui/render';

const app = document.getElementById('app')!;
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
let state = newState();

telemetry.startSession(state);

function dispatch(action: Action, rerender = true): void {
  const prev = state;
  state = reduce(state, action, Math.random);
  if (action.type === 'restart') {
    telemetry.recordDispatch(prev, action, state, rerender);
    telemetry.startNewRun(state);
  } else {
    telemetry.recordDispatch(prev, action, state, rerender);
  }
  if (state === prev || !rerender) return;
  render(app, state);
  if (state.screen !== prev.screen) window.scrollTo(0, 0);
  // Brief suspense before results; the month itself was already simulated.
  if (state.screen === 'testing' && prev.screen !== 'testing')
    setTimeout(() => dispatch({ type: 'showResult' }), reducedMotion ? 0 : 1000);
}

window.addEventListener('error', e => {
  telemetry.recordError({
    message: e.message || 'Unknown error',
    stack: e.error instanceof Error ? e.error.stack : undefined,
    source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : 'window.error',
  }, state);
});

window.addEventListener('unhandledrejection', e => {
  const reason = e.reason;
  telemetry.recordError({
    message: reason instanceof Error ? reason.message : String(reason ?? 'Unhandled rejection'),
    stack: reason instanceof Error ? reason.stack : undefined,
    source: 'unhandledrejection',
  }, state);
});

wireEvents(dispatch, {
  recordUiEvent: (eventType, payload, durationMs) => telemetry.recordUiEvent(eventType, state, payload, durationMs),
  flushBeacon: () => telemetry.flushBeacon(),
});
render(app, state);
