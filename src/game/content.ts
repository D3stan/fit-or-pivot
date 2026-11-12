import type { Feature, FeatureKey, Segment, SegmentKey, Style, StyleKey } from './types';

export const FEATURES: Record<FeatureKey, Feature> = {
  invoice: { name: 'Invoice export', icon: '🧾', desc: 'Turn your work into invoices and export them' },
  remind: { name: 'Smart reminders', icon: '⏰', desc: 'Nudges for deadlines, orders and payments' },
  team: { name: 'Team sharing', icon: '👥', desc: 'Share plans and schedules with other people' },
  stats: { name: 'Analytics dashboard', icon: '📊', desc: 'Charts about progress and performance' },
  design: { name: 'Polished design', icon: '🎨', desc: 'Beautiful themes and animations' },
};

export const STYLES: Record<StyleKey, Style> = {
  playful: { label: 'Playful', emoji: '🎈', desc: 'Friendly, colourful, a bit cheeky' },
  minimal: { label: 'Minimal', emoji: '⚪', desc: 'Calm, clean, no fuss' },
  professional: { label: 'Professional', emoji: '💼', desc: 'Serious, polished, data-driven' },
};

/** Hidden truth about each customer segment. The player never sees the weights. */
export const SEGMENTS: Record<SegmentKey, Segment> = {
  students: {
    name: 'Student freelancers', emoji: '🎓', style: 'playful', primary: 'invoice', secondary: 'remind',
    surface: 'Young, always online, juggling small gigs. They say: “I just want something to organise my work.”',
    need: { invoice: .5, remind: .3, team: .05, stats: .05, design: 0 },
    hidden: 'Getting paid. They lose money because they invoice late and forget to chase clients.',
    interview: [
      '“If I could fix one thing, it would be getting paid on time. Not my to-do list.”',
      '“When a client is late I have to chase them, and I never remember who owes me what.”'],
    q: {
      miss1: '“My biggest headache is getting paid. I always forget to send invoices on time.”',
      got1: '“Exporting an invoice in two clicks is the reason I open {name}.”',
      miss2: '“I would use it more if it nudged me when a client still owes me money.”',
      got2: '“The reminders mean I finally chase late payments.”',
      tone: '“It feels a bit too serious for me.”',
    },
  },
  cafes: {
    name: 'Small café owners', emoji: '☕', style: 'minimal', primary: 'team', secondary: 'remind',
    surface: 'Busy, tiny margins, no time. They say: “I need better tools.”',
    need: { team: .5, remind: .3, invoice: .05, stats: .05, design: 0 },
    hidden: 'Coordinating staff. The shift plan lives in a chat group and changes get missed.',
    interview: [
      '“My real problem is the staff. Who works when, and who swapped with who.”',
      '“Orders to suppliers get forgotten when it is busy.”'],
    q: {
      miss1: '“The shift plan lives in a chat group. Half my staff never see the changes.”',
      got1: '“Everyone sees the same shift plan in {name}. No more chat chaos.”',
      miss2: '“I forget supplier orders unless something reminds me.”',
      got2: '“The reminders save us from running out of milk on a Saturday.”',
      tone: '“Too much going on. I want it calm and simple.”',
    },
  },
  teams: {
    name: 'Remote startup teams', emoji: '💻', style: 'professional', primary: 'stats', secondary: 'team',
    surface: 'Small, ambitious, spread over time zones. They say: “We need more insight.”',
    need: { stats: .5, team: .3, remind: .05, invoice: .05, design: 0 },
    hidden: 'Seeing what is going on. Nobody has one shared view of progress and results.',
    interview: [
      '“What we lack is insight. Are we on track or not? Nobody can tell.”',
      '“Everyone has their own spreadsheet. We need one shared place.”'],
    q: {
      miss1: '“We have no idea how we are doing. I want progress and numbers in one place.”',
      got1: '“The dashboard in {name} is the first thing we open on Monday.”',
      miss2: '“Everyone keeps their own list. We lack a shared view.”',
      got2: '“One shared board stopped the ‘who is doing what?’ meetings.”',
      tone: '“Cute, but my team needs it to feel more professional.”',
    },
  },
};

export const SURPRISE: { name: string; idea: string }[] = [
  { name: 'Flowly', idea: 'An app that turns messy to-do lists into a calm plan for the week.' },
  { name: 'Taskaroo', idea: 'A friendly work organiser that keeps small teams on the same page.' },
  { name: 'Nudge', idea: 'A tiny assistant that reminds you of the things you always forget.' },
  { name: 'Plotline', idea: 'A simple tool that shows where your work is going and where it gets stuck.' },
];
