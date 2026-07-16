---
title: "Verify the styling architecture (raw CSS vs Tailwind) BEFORE dispatching a multi-file CSS migration"
kind: anti_pattern
date: 2026-07-12
area: CommonPlace apps/web design system
rule_short: "Before editing or fanning out work across .module.css files, confirm the project's intended styling mechanism. CommonPlace v2 is migrating OFF raw CSS onto Tailwind v4 register utilities; editing raw CSS is the wrong direction even when it 'works'."
---

## trigger_case

Task was "relief-kill the v2 shell" (remove porcelain wells/shadows/gradients). I scoped it as editing the ~21 raw `.module.css` files, wrote a prescriptive mapping doc, and fanned out 5 parallel subagents to edit raw CSS. Mid-flight the user asked: "we're no longer using raw CSS, right? it's the installed Tailwind v4?" Verification showed: Tailwind v4.1.18 IS installed, `global.css` maps `--cr-*` tokens into `@theme` utilities (`bg-cr-surface` etc.), and the ~64 `.module.css` files are exactly the "700KB of hand CSS" the console-register spec names as diagnosis #1. The relief-kill-in-raw-CSS work was throwaway (those modules get deleted when converted to utilities). Stopped the agents, reverted all 12 edited files back to the merge base.

## rule

- A styling task is not just "what to change" but "in what mechanism." Grep `package.json` for `tailwindcss`, read `global.css` for `@import "tailwindcss"` + `@theme`, and check whether the surface's spec calls for utilities vs CSS, BEFORE touching CSS files.
- "It compiles and looks flat" is not "it's the right approach." Editing raw CSS on a codebase that is migrating to utilities produces work that is deleted by the migration it was supposed to serve.
- When a spec's own diagnosis names the file type you are about to edit as the problem ("hand CSS is diagnosis #1"), that is a signal to change mechanism, not to edit the file.
- Persisted the standing rule to `apps/web/CLAUDE.md` (`## Visual Design & CSS`, first bullet) and to auto-memory so future sessions do not repeat this.
