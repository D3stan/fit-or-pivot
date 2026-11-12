// Pure formatting helpers shared by game and UI (no DOM access).

/** HTML-escape text. Every piece of player-typed text must pass through here before reaching innerHTML. */
export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const eur = (n: number): string => (n < 0 ? '-' : '') + '€' + Math.abs(n / 1000) + 'k';

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
