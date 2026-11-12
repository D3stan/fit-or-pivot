import { START_CASH } from './config';
import type { State } from './types';

export function newState(): State {
  return {
    screen: 'intro', month: 0, cash: START_CASH, name: '', idea: '', style: 'playful',
    segment: null, features: [], sat: 40, ret: 10, vd: 10, streak: 0, history: [], notes: {},
    pivots: 0, interviews: 0, everDesign: false, modal: null, ended: null, prev: null,
    quotes: [], msg: null, lastDecision: '', pick: [], setupError: '',
  };
}
