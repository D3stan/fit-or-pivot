export const START_CASH = 100000;
export const BURN = 5000;
export const MAX_MONTH = 12;

export const FEATURE_COST = 5000;
export const ITER_COST = 4000;
export const ADD_COST = 12000;
export const PIVOT_COST = 20000;
export const INTERVIEW_COST = 2000;

/** Metrics a pivot restarts from. */
export const PIVOT_START = { ret: 8, vd: 10, sat: 40 };

export const MAX_FEATURES = 4;
export const MVP_FEATURES = 2;

/** Fit test: share of "very disappointed" users and share still active. */
export const VD_TARGET = 40;
export const RET_TARGET = 30;
/** Consecutive fit months needed to win. */
export const WIN_STREAK = 3;
/** Satisfaction minus retention at or above this means "polite but gone". */
export const POLITE_GAP = 18;
/** Cash at or below this makes the runway pill blink. */
export const LOW_CASH = 10000;
