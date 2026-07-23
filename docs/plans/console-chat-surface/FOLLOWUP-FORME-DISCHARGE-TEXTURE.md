# Follow-up: FORME DischargeState for chat receipt texture

Status: deferred by consent 2026-07-23 (console chat surface plan).

## Product need

HANDOFF-CONSOLE-CHAT-SURFACE choice 5 and SPEC-MATERIAL-REGISTER-1.0 named
choice 5 both want tool receipts and related excerpts to carry epistemic
texture from `DischargeState`:

- Deterministic: clean surface
- Discharged: fine grain
- Undischarged: coarse dither
- Refused: fluted or obscured

Chat CH2 ships Deterministic only. Rendering Undischarged or Refused before
the backend can produce those values would invent an epistemic signal.

## Backend gap

FORME / HANDOFF-FORME-TYPE-SYSTEM D4 must expose reachable `DischargeState`
(or an equivalent typed field) on tool receipts and process liveness refused
cases that CommonPlace console can read through the object seam or chat
stream metadata.

Until that lands:

- `apps/console/src/lib/material/materials.ts` keeps non-Deterministic entries
  with `reachable: false`
- Chat excerpt chrome stays Deterministic via `ShaderSurface` / flat raised
  surfaces
- Collapse headers and summary lines remain authoritative without texture

## Acceptance when unblocked

1. A live tool receipt carries a DischargeState the console can read.
2. Expanding or collapsing the excerpt switches material through
   `resolveMaterial` without hand-mapped fake states.
3. `prefers-reduced-motion` still freezes shader speed at 0.
4. Texture never carries hue; kind markers stay independent.

Owner surface when ready: console chat excerpt component plus material map
reachability flip; no parallel texture system.
