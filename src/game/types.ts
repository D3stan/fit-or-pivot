export type FeatureKey = 'invoice' | 'remind' | 'team' | 'stats' | 'design';
export type StyleKey = 'playful' | 'minimal' | 'professional';
export type SegmentKey = 'students' | 'cafes' | 'teams';

export type Screen = 'intro' | 'setup' | 'customer' | 'build' | 'testing' | 'result' | 'decide' | 'end';
export type Decision = 'Launch MVP' | 'Persevere' | 'Iterate' | 'Add a feature' | 'Pivot';
export type Ending = 'win' | 'broke' | 'time';

export interface Feature { name: string; icon: string; desc: string; /** What building it tests. */ test: string }
export interface Style { label: string; emoji: string; desc: string }

export interface Segment {
  name: string;
  emoji: string;
  style: StyleKey;
  primary: FeatureKey;
  secondary: FeatureKey;
  surface: string;
  /** Hidden weights: how much each feature solves this segment's real problem. */
  need: Record<FeatureKey, number>;
  hidden: string;
  interview: string[];
  /** Quote templates; `{name}` is replaced with the product name. */
  q: { miss1: string; got1: string; miss2: string; got2: string; tone: string };
}

export interface Metrics { sat: number; ret: number; vd: number; cash: number }

export interface HistoryRow {
  month: number;
  vd: number;
  ret: number;
  sat: number;
  cash: number;
  decision: Decision;
  segment: SegmentKey;
  features: FeatureKey[];
  style: StyleKey;
}

/** Before/after of the month just played, with where the cash went. */
export interface Impact {
  /** Cash at the end of last month (before interviews and the decision); metrics before the decision. */
  before: Metrics;
  after: Metrics;
  /** What the cash was spent on this month; before.cash minus their sum is after.cash. */
  costs: { label: string; amount: number }[];
  /** One plain-text sentence linking the decision to what moved. */
  link: string;
}

export interface Message { cls: 'good' | 'warn' | 'bad'; text: string }

export type Modal =
  | { type: 'help' }
  | { type: 'iterate'; remove: FeatureKey | ''; add: FeatureKey | ''; style: StyleKey }
  | { type: 'add'; add: FeatureKey | '' }
  | { type: 'pivot'; seg: SegmentKey | ''; idea: string; style: StyleKey };

export interface State {
  screen: Screen;
  month: number;
  cash: number;
  name: string;
  idea: string;
  style: StyleKey;
  segment: SegmentKey | null;
  features: FeatureKey[];
  sat: number;
  ret: number;
  vd: number;
  streak: number;
  history: HistoryRow[];
  notes: Partial<Record<SegmentKey, string[]>>;
  pivots: number;
  interviews: number;
  everDesign: boolean;
  modal: Modal | null;
  ended: Ending | null;
  prev: Metrics | null;
  impact: Impact | null;
  /** Interview spend since the last month was played. */
  interviewSpend: number;
  quotes: string[];
  msg: Message | null;
  lastDecision: Decision | '';
  /** Features ticked on the build screen, before launch. */
  pick: FeatureKey[];
  setupError: string;
}

/** Returns a float in [0, 1), like Math.random. */
export type Rng = () => number;
