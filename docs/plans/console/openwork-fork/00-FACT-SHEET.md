# Fact sheet: different-ai/openwork

Plan `plan:c8307a874c5981f5`. Spec `SPEC-COMMONPLACE-OPENWORK-FORK-1.0`, task `frame-fact-sheet`.

Upstream pinned at `different-ai/openwork` branch `dev`, commit
`2f2dde65796428109a665f3b733843fe3896b933`, read 2026-08-02.

Every Frame claim in the spec is listed below with the source path that carries it
and the verdict from reading that path. Claims that did not survive verification
are marked **CORRECTED** and carry the real finding; the spec's amendment log takes
these up.

## Licensing

| Claim | Source | Verdict |
|---|---|---|
| `/ee` is Fair Source, everything else MIT | `LICENSE` | Confirmed in substance. **CORRECTED** in name: `ee/LICENSE` is the **Functional Source License 1.1 with an MIT future grant (FSL-1.1-MIT)**, not a license literally titled "Fair Source License". FSL is a Fair-Source-category license, so the bright line holds; the spec's wording is imprecise, not wrong. |
| Third-party components keep their own licenses | `LICENSE` | Confirmed. |
| `apps/server/package.json` declares MIT directly | `apps/server/package.json:42` | Confirmed. `"license": "MIT"`. |
| `apps/app` is outside `/ee` | tree | Confirmed. **Nuance:** `apps/app/package.json` declares **no `license` field at all**. It is MIT by the root LICENSE's residual clause, not by its own declaration. The vendored fork should state MIT explicitly rather than inherit silently. |

## Not Electron-locked

| Claim | Source | Verdict |
|---|---|---|
| `apps/app` ships `build:web` with `VITE_OPENWORK_DEPLOYMENT=web` | `apps/app/package.json:11` | Confirmed, and it carries a second flag the spec named: the full script is `VITE_OPENWORK_DEPLOYMENT=web VITE_DEN_REQUIRE_SIGNIN=1 vite build`. The Den sign-in requirement is baked into the web build exactly as the spec predicted. |
| Browser-entry tests exist | `apps/app/scripts/browser-entry.mjs`, script `test:browser-entry` | Confirmed. |
| Remote-workspace diagnostics exist | `apps/app/scripts/remote-workspace-diagnostics.test.ts` | Confirmed. |
| `apps/desktop` wraps the same renderer | `apps/desktop`, `apps/app/src/app/lib/runtime-env.ts` | Confirmed. The renderer branches at runtime on `isElectronRuntime()` / `isDesktopRuntime()` rather than compiling separately. |

The deployment switch is a single module, `apps/app/src/app/lib/openwork-deployment.ts`:
`VITE_OPENWORK_DEPLOYMENT` normalizes to `"web" | "desktop"`, **defaulting to
`desktop` when unset**. The fork must set it explicitly; an unset variable silently
selects the desktop path.

## openwork-server

| Claim | Source | Verdict |
|---|---|---|
| Bun filesystem-backed API for remote clients | `apps/server` | Confirmed. |
| Persists through better-sqlite3 and Drizzle | `apps/server/package.json` | Confirmed as dependencies: `better-sqlite3 ^12.11.1`, `drizzle-orm ^0.45.1`. **See the correction in `01-VERIFY-FIRST.md` §5 for what is actually persisted — it is not sessions or artifacts.** |
| Ships five opencode plugins | `apps/server/src/opencode-plugins` | **CORRECTED. There are six plugin factories, not five**, plus two non-factory modules. Enumerated in `01-VERIFY-FIRST.md` §4. |
| Compiled to single binaries for six targets | `apps/server` build config | Not re-verified this pass; not load-bearing for any acceptance criterion. Recorded as unverified rather than asserted. |

## Renderer stack

`apps/app/package.json`, 53 runtime dependencies. Confirmed present: React 19,
Tailwind 4, shadcn-style primitives, cmdk, CodeMirror 6, xterm,
react-resizable-panels, zustand, TanStack Query and Virtual, motion, Lexical,
marked + shiki + katex, sonner, `@base-ui/react`, `@paper-design/shaders-react`.

The convergence claim holds: `@base-ui/react` is the same primitive layer
`packages/twenty-ui` builds on, and `@paper-design/shaders-react` is the same
shader library the console already mounts in
`apps/console/src/components/canvas/PaperCanvas.tsx`.

## Engine seam

| Claim | Source | Verdict |
|---|---|---|
| Renderer speaks `@opencode-ai/sdk` | 46 files across `apps/app` and `apps/server` | Confirmed. Enumerated in `02-SEAM-AUDIT.md`. |
| With AI SDK v6 streaming primitives | `apps/app/package.json:63` (`ai ^6.0.146`), `:40` (`@ai-sdk/react ^3.0.148`) | **CORRECTED, and this is the most consequential correction on the sheet.** The `ai` package is imported **type-only** throughout. `@ai-sdk/react` has **zero import sites** in the source tree. AI SDK v6 is a transcript *type vocabulary*, not a transport. All streaming is opencode SDK. Detail in `01-VERIFY-FIRST.md` §5. |

## Upstream cadence

Measured 2026-08-02 against the GitHub API, not inferred.

- 30 most recent `dev` commits span three days: 12 on 2026-07-31, 8 on 2026-08-01,
  10 on 2026-08-02. Roughly ten commits per day.
- 287 open pull requests.

This prices the cherry-pick posture honestly: `dev` moves about an order of
magnitude faster than the OWOX donor did, and the open-PR backlog means upstream
review is not a bottleneck the fork can wait behind. The posture is a **pinned
snapshot with selective cherry-picks**, not continuous tracking. Recorded against
named choice 1.
