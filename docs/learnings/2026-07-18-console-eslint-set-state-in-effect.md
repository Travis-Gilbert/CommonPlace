---
title: apps/console eslint blocks setState-in-useEffect; use render-time state adjustment for prop-driven UI state
kind: gotcha
date: 2026-07-18
scope: apps/console (React 19 + React Compiler eslint)
---

## trigger_case (the real scar)

Wiring the proactivity block palette, `IntentComposer.tsx` needed to open and
prefill when a compile-only block-add set a `hint` prop. The obvious code:

```tsx
useEffect(() => {
  if (hint) {
    setOpen(true);
    setIntent(hint);
  }
}, [hint]);
```

`npm run lint` failed with a **blocking error** (not a warning):
`react-hooks/set-state-in-effect` — "Avoid calling setState() directly within an
effect ... causes cascading renders." The gate `npm run lint` fails CI, so the
effect could not ship.

## rule_short

In `apps/console`, never call `setState` synchronously in a `useEffect` body. For
"do X when a prop changes" UI state, adjust state **during render**, guarded by a
"last seen prop" state var (React's sanctioned pattern), which the linter allows:

```tsx
const [seenHint, setSeenHint] = useState<string | undefined>(hint);
if (hint !== seenHint) {
  setSeenHint(hint);
  if (hint) {
    setOpen(true);
    setIntent(hint);
  }
}
```

## why

The console's eslint config promotes `react-hooks/set-state-in-effect` to error
(React Compiler discipline). The render-time adjustment re-renders immediately
without committing the intermediate state, so there is no cascading-render
effect and no lint violation. Reach for an effect only to synchronize with an
external system, not to derive React state from a prop.
