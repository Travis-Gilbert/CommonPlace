# Native shell chrome design brief

Source: SPEC-COMMONPLACE-NATIVE-SHELL-1.0 B4 + CommonPlace porcelain register.
Paper file: Island Shells → page **Native Shell** (`5-0`).
Artboard created: **Native window 1440** (empty; MCP write quota exhausted).

## Direction

Clarity over spectacle. The GPUI shell is quiet authority: window frame, omnibox,
DockArea, rail, and native prompts. Content realms (React + Servo) own the
interior. Brand signal is the wordmark in the title bar, not a marketing hero.

## Palette (from `console-register.css`)

| Token | Value |
|-------|-------|
| ground | `oklch(91.5% 0.005 72)` |
| surface | `oklch(96.7% 0.005 72)` |
| top | `oklch(98.9% 0.005 72)` |
| ink | `oklch(34% 0.012 72)` |
| ink-2 | `oklch(45% 0.012 72)` |
| ink-3 | `oklch(56% 0.012 72)` |
| hairline | `rgba(20, 20, 19, 0.10)` |
| signal | `oklch(54.25% 0.12 24)` |
| link | `oklch(52.25% 0.06 218)` |
| tint | `color-mix(in oklab, signal 12%, transparent)` |

## Type

- UI: IBM Plex Sans (weights 400 / 500 / 600)
- URL and receipts: JetBrains Mono 11–12px
- No display serif in chrome (Vollkorn stays in React content)

## Composition (1440 × 900)

1. **Title bar** (top / hairline): traffic lights · **CommonPlace** wordmark + `NATIVE` caption · session status
2. **Omnibox row** (surface): back/forward · omnibox (HTTPS chip · canonical URL · `go · ask · find`) · presence chip
3. **Body** (flex row, ground):
   - Left **capability rail** (~56px icons / 180px expanded labels)
   - Center **DockArea tabs**: CommonPlace workspace tab + Servo tab(s); content rect is the webview/Servo hole
   - Optional right **evidence** dock (collapsed by default)
4. **Bottom dock** (surface / hairline): downloads · activity · approvals (compact strip)

## Laws encoded in the mock

- Permission / takeover prompts sit in a **chrome strip under the omnibox**, never
  overlapping the center content rect (z-order law).
- Presence chip is native chrome; React/Servo render cursors inside their surfaces only.
- No cards in chrome. No purple. No glass overlays on content.

## Artboards to complete when Paper writes resume

1. Native window 1440 (full shell)
2. Permission prompt strip (Allow / Deny camera for origin)
3. Capability rail expanded + click-to-add
4. Side-by-side resize: CommonPlace | Servo

Paste-ready HTML for artboard 1: `docs/plans/native-shell/paper-chrome-paste.html`.
