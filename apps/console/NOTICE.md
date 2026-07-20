# NOTICE

## Color sources

- IntelliJ Dark and Light palette values come from JetBrains `intellij-community` under Apache-2.0. Dark remains in its original console register; Light records its upstream commit and source checksum in `src/styles/int-ui-register-light.css`.
- GitHub Dark and Light functional colors are anchored to `@primer/primitives` 11.9.0 under MIT.

## Adopted components

- `src/components/commit-graph.tsx` and `src/components/repo-card.tsx` are
  jalco-ui `@jalco/commit-graph` and `@jalco/repo-card` by Justin Levine
  (`https://ui.justinlevine.me`), adopted through the shadcn registry declared
  in `components.json` and retokened in place. Upstream repository
  `github.com/jal-co/ui`, **MIT License**, `LICENSE` blob SHA
  `160c1593d90acd73205bd976ef11a66c1986dfa0`, verified at adoption
  (2026-07-19). The MIT terms permit use, modification, and redistribution with
  the copyright notice retained; the attribution header at the top of each file
  is that notice, and it stays there. Registry manifests fetched from
  `https://ui.justinlevine.me/r/commit-graph.json` and
  `https://ui.justinlevine.me/r/repo-card.json`.
- Deviations from upstream are named in each file's header comment rather than
  left to a reader's diff: register retokening, the speaker-register rail
  colors, no GitHub glyphs (decision 12 holds this surface to no new glyphs),
  no `api.github.com` fetch (upstream's own `data` prop is the path taken), a
  `div` root instead of an `<a>`, and no shadows (depth here is value and seam).

## Noun Project icons

Product and domain glyphs use individual Noun Project marks already held under this workspace account's paid royalty-free plan. Canonical normalized sources and icon IDs live in `src/assets/icons/noun/`; they render with `currentColor`. Paid product use does not require attribution. The account holder is responsible for keeping that license coverage current.
