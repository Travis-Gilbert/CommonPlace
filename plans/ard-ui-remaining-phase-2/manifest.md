# Manifest: ARD UI Remaining Phase 2 (ard-ui-remaining-phase-2)

**Goal ID:** `goal:aa1c8c6380701610`  
**Budget Clock:** 40 hours  
**Status:** Charted, pending gate check  

## Gist Tier (Nodes)

- **pass1-workos** (work) — Implement next-auth swap to WorkOS AuthKit
- **verify-pass1-workos** (verify) — Verify WorkOS session profile parsing & callback handling
- **pass2-live-smoke** (work) — Integrate live metadata REST and programmable graph gallery
- **verify-pass2-live** (verify) — Verify live proxy connections without LocalDev fallbacks
- **pass3-substrate-seams** (decision) — Re-evaluate substrate seam APIs for D20-D23 / D33-D36 once land
- **pass3-substrate-ui** (work) — Implement frontend UI for sweep, fingerprint, and cache-pressure
- **verify-pass3-substrate** (verify) — Verify D20-D23 and D33-D36 UI with live substrate evidence

## Edge List (Dependency Graph)

- `start` --> `pass1-workos`
- `pass1-workos` --> `verify-pass1-workos`
- `verify-pass1-workos` --> `pass2-live-smoke`
- `pass2-live-smoke` --> `verify-pass2-live`
- `verify-pass2-live` --> `pass3-substrate-seams`
- `pass3-substrate-seams` --> `pass3-substrate-ui`
- `pass3-substrate-ui` --> `verify-pass3-substrate`
- `verify-pass3-substrate` --> `destination`
