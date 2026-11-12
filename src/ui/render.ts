import type { Screen, State } from '../game/types';
import { modal } from './components/modal';
import { build } from './screens/build';
import { customer } from './screens/customer';
import { decide } from './screens/decide';
import { end } from './screens/end';
import { intro } from './screens/intro';
import { result } from './screens/result';
import { setup } from './screens/setup';
import { testing } from './screens/testing';

const SCREENS: Record<Screen, (s: State) => string> = { intro, setup, customer, build, testing, result, decide, end };

export function render(app: HTMLElement, s: State): void {
  const active = document.activeElement?.id;
  app.innerHTML = SCREENS[s.screen](s) + modal(s);
  // innerHTML replaces the inputs, so put focus back where the player was typing.
  if (s.screen === 'setup' && !s.modal && active) document.getElementById(active)?.focus();
  if (s.modal) app.querySelector<HTMLElement>('.modal select, .modal input[type=text], .modal .btn')?.focus();
  document.title = 'Fit or Pivot';
}
