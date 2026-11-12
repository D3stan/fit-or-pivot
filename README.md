# Fit or Pivot

A small browser game about finding product-market fit. You have €100k and 12 months:
pick a customer segment, build an MVP, read the monthly feedback, then persevere,
iterate, add a feature or pivot. You win after passing the fit test (40% "very
disappointed" without your app and 30% still active) three months in a row.

Vite + TypeScript, no UI framework: screens are functions that return HTML strings.

## Run

```sh
npm install
npm run dev        # local dev server
npm test           # Vitest, game engine
npm run typecheck  # tsc --noEmit (strict)
npm run build      # typecheck + production build to dist/
npm run preview    # serve dist/
```

## Layout

```
index.html            page shell
src/
  main.ts             store, dispatch, testing-screen timer, first render
  format.ts           esc (HTML escaping), eur, clamp
  game/               pure rules, no DOM
    config.ts         costs, burn, thresholds, months
    content.ts        features, tones, customer segments, surprise ideas
    types.ts          State, Modal, keys…
    state.ts          newState()
    engine.ts         runMonth, needScore, quotes, messages, endings, insights (rng injected)
    actions.ts        reduce(state, action, rng) -> state
  ui/
    render.ts         state -> #app, focus restore
    events.ts         delegated listeners: data-a (actions), data-m (modal fields)
    components/       top bar, KPIs, chart, notes, option card, modal…
    screens/          intro, setup, customer, build, testing, result, decide, end
  styles/             tokens.css, base.css, components.css
tests/engine.test.ts
```

Player-typed text (product name, idea) must go through `esc()` before it reaches `innerHTML`.
