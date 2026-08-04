---
title: The workspace root can hoist a different major than the app resolves
kind: gotcha
date: 2026-08-03
scope: pnpm workspace (apps/console + packages/*) — any dependency API lookup
---

## trigger_case (the real scar)

Before rebuilding the console right rail on `react-resizable-panels`, I read
the type declarations at the repo root:

```
node_modules/react-resizable-panels/dist/react-resizable-panels.d.ts
```

That copy is **4.12.2**, whose API is `Group` / `orientation` /
`onLayoutChange` / `defaultLayout`. I was one step from writing v4 code into
`IntuiShell.tsx`, which imports `{ Panel, PanelGroup, PanelResizeHandle }`
and passes `direction=` and `onLayout=`.

`apps/console/package.json` pins `^3.0.6`, and resolving from inside the app
gives a different path entirely:

```
node_modules/.pnpm/react-resizable-panels@3.0.6_react-dom@19.2.3_react@19.2.3__react@19.2.3/
```

Both majors are installed at once because a different workspace package pulls
4.x. The root copy is not the app's copy, and pnpm's `.pnpm` store means the
app's declarations live under a version-and-peer-hashed directory that a root
`node_modules/<pkg>` read will never reach.

## rule_short

Resolve a dependency's version and API **from the package that imports it**,
never from the repo root:

```bash
cd apps/console && node -p "require('<pkg>/package.json').version"
cd apps/console && node -p "require.resolve('<pkg>')"
```

Then read the `.d.ts` next to that resolved path. In this workspace the type
declarations are usually at `dist/declarations/src/<Component>.d.ts`, not the
single rolled-up `dist/<pkg>.d.ts`. Confirm the exported names too
(`node -p "Object.keys(require('<pkg>')).join(', ')"`) before writing against
remembered API shapes.
