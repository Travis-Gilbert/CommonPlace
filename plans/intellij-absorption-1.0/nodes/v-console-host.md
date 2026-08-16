# v-console-host: verify sibling of console-host

- kind: verify
- controller: agent
- verifies: `console-host`
- state: parked-superseded (2026-08-16; d12 retracts the CommonPlace `/IDE` destination for AgentFS. Do not run this oracle as the AgentFS product gate.)

## Fixed oracle

| Obligation | Proof | Acceptance | oracle_class | implementation_mode | evidence_class | substitution_allowed | live_oracle_required |
|---|---|---|---|---|---|---|---|
| O-CH.1 | Repository path audit plus provenance/license ledger | No browser-rendering workbench source remains owned by Theorem; pinned UI-neutral protocol/backend seam is named | source ownership | production | source audit receipt | false | false |
| O-CH.2 | Clean double-build plus artifact-manifest comparison | Protocol version and all SHA-256 digests match; sizes recorded | deterministic artifact | production | digest comparison receipt | false | false |
| O-CH.3 | Edge proxy unit test, production-bundle scan, WebSocket handshake | Same-origin `/IDE` transport; no loopback target or client-controlled absolute workspace path | authenticated integration | production | real transport receipt | false | true |
| O-CH.4 | Headed browser script against a real local proxy/backend | Boot, Initialize, ReadDir, open, Update, no panic | stateful browser integration | production | headed browser receipt | false | true |
| O-CH.5 | Scoped CommonPlace gates and production build | All commands exit 0; no unrelated dirty paths included | deterministic build | production | command receipts | false | false |
| O-CH.6 | Signed-in live smoke on `v2.theoremharness.com/IDE` | New host and authenticated workspace work; rollback target remains available until acceptance | deployed product | production | signed-in live receipt | false | true |

Mocks and the S0 static server cannot discharge O-CH.3, O-CH.4, or O-CH.6. O-CH.6 is live-only and may be parked with the exact deploy trigger, but the node cannot be called fixpoint without it.
