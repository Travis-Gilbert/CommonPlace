# Edges: Handoff Matrix

## Edges

### start --> pass1-workos
- **Handoff state:** decided
- **Consumes:** None
- **Produces:** Current auth file `apps/console/src/lib/auth.ts`
- **Tension/Learned:** Auth.js is configured for GitHub; we must swap to WorkOS.

### pass1-workos --> verify-pass1-workos
- **Handoff state:** remains
- **Consumes:** Updated `auth.ts` with WorkOS provider
- **Produces:** Local browser/mock authentication flows
- **Tension/Learned:** Needs a test client/mock to verify without production credentials.

### verify-pass1-workos --> pass2-live-smoke
- **Handoff state:** remains
- **Consumes:** Fully working WorkOS auth shell
- **Produces:** env-gated configurations
- **Tension/Learned:** Requires the upstream server to be accessible.

### pass2-live-smoke --> verify-pass2-live
- **Handoff state:** remains
- **Consumes:** Metadata REST forwarder and substrate gallery clients
- **Produces:** Running smoke script output
- **Tension/Learned:** Smoke script can be run with `node apps/console/scripts/smoke-metadata-rest.mjs`.

### verify-pass2-live --> pass3-substrate-seams
- **Handoff state:** remains
- **Consumes:** Working live proxy confirmation
- **Produces:** Substrate API analysis report
- **Tension/Learned:** Decisions rely on whether the substrate actually exposes endpoints for Part 4/6 items.

### pass3-substrate-seams --> pass3-substrate-ui
- **Handoff state:** remains
- **Consumes:** Confirmed substrate endpoint contracts
- **Produces:** New UI panels and widgets in ProgramView / RunRail
- **Tension/Learned:** Avoid inventing fake UI mockups in the console without live backend coverage.

### pass3-substrate-ui --> verify-pass3-substrate
- **Handoff state:** remains
- **Consumes:** Completed Part 4 & Part 6 UI surfaces
- **Produces:** Execution test suite run evidence
- **Tension/Learned:** Focused vitest / Playwright scenarios to guarantee visual and computational fidelity.

### verify-pass3-substrate --> destination
- **Handoff state:** remains
- **Consumes:** All verified components
- **Produces:** Fully complete and production-ready Console v2
- **Tension/Learned:** The ultimate exit. Fixpoint achieved.
