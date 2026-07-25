# SPEC-COMMONPLACE-FILING-AND-INDEX-1.0: acceptance report

Per CONVENTIONS: leading with what is not done or not verified.

## Not done, or not verified

| Item | State | Why |
|---|---|---|
| **B7 doors (GraphQL + MCP)** | **in flight, unverified** | Delegated and running at the time of writing. Until it lands, `commonplace-api` exposes no filing field and `rustyred-thg-mcp` exposes no filing tool, so the console reads its non-production fixture rather than the engine. Nothing about the engine or the surface changes when it lands; the seam is already typed on both sides. |
| Playwright visual baselines for the Index | not generated | The Index has behavioral e2e (8/8 green) but no committed `-darwin.png` / `-linux.png` snapshots, so it is not yet in the pixel-diff baseline set. CI's linux baselines cannot be produced on this machine; the established route is to harvest them from a failed CI run's `-actual.png` artifacts. |
| Index captures in the light register | not captured | Both themes are covered by the contrast gate and by the existing five-signature pass, but the Index's own captures exist for dark only. The one light capture taken during this session was invalid: the harness forced `data-theme` after load without re-running the theme bootstrap, so it rendered a half-applied register. That was a capture-harness fault, not a surface fault, and it is not evidence either way. |
| Sieve script deployment to a JMAP host | out of scope, per the spec | The compiler ships and is tested; deployment per host is a documented step the spec explicitly does not automate. |
| Live tier-2 escalation against Gemma 12B | not exercised | `HttpEscalator` is tested through its request body and its validation paths, and the cascade is tested through a fixed escalator. No live model was called, because none is configured here. |

## Backend

| Deliverable | Acceptance | Verified how |
|---|---|---|
| B1 envelope and adapters | each adapter's fixture yields a well-formed envelope with source provenance; a malformed record skips with the count in the report; the mail adapter compiles against the seam with a fixture transport | 8 tests in `adapt.rs`. The skip test feeds 4 records, 2 malformed, and asserts 2 filed, 2 skipped, and that a skip names the record it came from. |
| B2 tier 0 | precedent files from a known sender to that sender's historical collection with the precedent named; rules evaluate in deterministic order; `compile_sieve` parses under a grammar check and round-trips destinations; non-mail predicates refused with a typed error | 14 tests in `t0.rs`. The grammar check is a recursive-descent validator for the emitted RFC 5228 subset, written here because the workspace has no Sieve crate; it is proven real by a test that feeds it four hand-broken scripts and asserts each is rejected. |
| B3 tier 1 | beats the majority-class baseline on a held-out split by the margin recorded here; a correction changes an identical later item; margins reproducible; human corrections outweigh agent ones; weights survive reopen | **Measured margin: +0.463.** Tier 1 scored 0.854 (35/41) against a 0.390 (16/41) majority-class baseline on a 41-item held-out split of a 100-item fixture corpus over 4 unequal classes. `cargo test -p rustyred-thg-filing --test tier1_baseline -- --nocapture`. 12 further tests in `t1.rs`. |
| B4 tier 2 | the ambiguous fixture escalates and the receipt carries the model reason; the confident fixture does not escalate (call counter); budget exhaustion files on tier 1 with the low-confidence flag and no blocking; schema violations have a refusal path | 15 tests in `t2.rs`. The band was corrected during the work: it is closed at both ends, because a dead tie is the most ambiguous an arrival can be and an exclusive lower bound skipped exactly the case that most needs the call. |
| B5 receipts, bus, undo | every filing yields a receipt whose attribution matches the deciding tier; correct emits exactly one bus event with an observable weight delta; undo restores the prior destination and emits its own event; the dismissal republish appears on the bus | 13 tests in `receipt.rs`, including one that walks file, correct, undo and asserts the reconstructed three-entry history. |
| B6 urgency lane | the urgent fixture fires exactly one event with its reason; the borderline fixture fires none; no counter state anywhere in the module | 9 tests in `urgent.rs`. The no-counter property is asserted, not merely inspected: the module holds no state between calls, and a test asserts repeated reads of the same window are equal. |

Engine totals: **77 unit tests + 3 acceptance tests green, clippy clean at `-D warnings`.** Commit `e2f535977` in the Theorem repo on `claude/filing-and-index`.

## Frontend

All in `apps/console`, not `apps/web`. Named deviation, not a cut: the console is the canonical product host (`apps/console/CLAUDE.md:11`) and a structural import fence makes `apps/web` a CI failure from here. Full F1-F5 scope shipped.

| Deliverable | Acceptance | Verified how |
|---|---|---|
| F1 the Index surface | zero badge or counter elements; drag-to-correct emits the correction and the undo toast reverses it; ribbon items age out at the boundary; calm at 10 items and 10,000 | **Badge absence verified on the rendered component tree**, not on source: the e2e walks every node under the Index roots and fails on any attribute matching badge/unread/counter/count, and on any bare-numeric status role. It found none. Contract-level backstop in `types.test.ts`: the only numbers on a receipt are its confidence and its tier. Boundary ageing is tested exactly at, one inside, and one outside the window. The 10,000-item claim rests on `@tanstack/react-virtual`, the same row the Files tree and the card grid already use; it is not separately measured. |
| F2 digest | the fixture window's digest matches the door's response; nothing generates a notification or count | The pull-not-push property is asserted (the digest does not render until asked for). Byte-for-byte agreement with B7's response cannot be checked until B7 lands. |
| F3 receipt affordance | receipts render for all three tiers; the correction path round-trips; the first-use line appears once and is dismissible | e2e opens a receipt per tier and asserts the tier marker and a non-empty attribution sentence for each. The dismissal test is what caught the per-instance bug described below. |
| F4 rules | authoring files the next matching arrival by tier 0; the Sieve preview matches the compiler output; consent activates and deny dismisses with nothing applied | The surface, its vocabulary, and the pending-consent pattern ship and are schema-tested. The three round-trip assertions need B7 and are not yet verified. |
| F5 urgent lane | the urgent fixture renders the event with its reason; the empty state renders the calm message; no counter in any state | Empty state and counter absence verified in e2e. The populated case is reachable behind `CONSOLE_E2E_FILING_URGENT=1` and is not yet in the suite. |

Console totals: **148 unit tests, 8 Index e2e checks, tsc clean, all six gates clean** (fence, register, contrast, motion, icons, token manifest). Commits `7dbd8ed` and `3edf002`.

## Defects found and fixed during the work

Three, all in code written this session, all caught by running it rather than reading it.

1. The receipt popover portaled behind the ribbon it anchors to, so its controls were unclickable. Caught by e2e.
2. The one-line law was dismissed per popover instance. Every ribbon row mounts its own, so a line that promised to appear once appeared once per item. Caught by e2e; fixed with a shared subscription.
3. The urgent lane drew its own title bar while `IntuiShell` already gives every tool window the Int UI header strip, so "Needs you today" rendered twice. Caught by a capture, not by a test.

One defect found in existing code and spun out rather than fixed here: `ThreadView.tsx:85` references `var(--ij-success)`, which no register file defines, so a completed agent-plan step's status dot falls through to no background in every theme. No gate catches it: the register lint checks the form of a value and the manifest gate checks definitions, not references.

## Design laws, and where each is held

| Law | Held by |
|---|---|
| The arrival state is sorted | `receipt::file` is the one write path and returns a receipt, never an `Option`. No "pending" variant exists in the crate. |
| Undo over approval | `correct` and `undo`. The only consent gate in the design is for standing rules, because a rule keeps acting after the moment it was made. |
| No unread counts | The wire contract carries no count, the urgency module holds no state, and the rendered tree is scanned. |
| Filing is presentation; Find is truth | Filing writes a membership edge and a receipt and touches no retrieval path. The law is rendered to the user on first use. |
| Nothing destructive is ever automatic | Corrections retire the old edge through `commonplace`'s contradiction path, which keeps provenance. Nothing in the crate deletes. |

## Named deviations from the spec text

Each was confirmed against the actual source before deviating, per the spec's own instruction.

1. **Frontend path.** Spec says `apps/web`; shipped in `apps/console`. See above.
2. **llguidance.** No crate in the workspace depends on it and no backend advertises grammar support, so there is no in-repo wire format to bind to. The schema travels as `response_format: {"type": "json_schema"}` over the OpenAI-compatible surface, which mistral.rs compiles to llguidance server-side, and the reply is validated on receipt anyway. This is the same choice `rustyred-thg-find`'s aspect labeler already documents.
3. **Type names.** `rustyred-thg-core` publishes no `NodeId`, `CollectionId`, `EmbeddingRef`, `GoldenRecordRef`, or `Generation`. The crate declares aliases so the spec signatures read as written, the move `rustyred-thg-find` already makes for `NodeId`.
4. **`Predicate::SenderEntity`.** Carries the entity's addresses alongside its id, because a Sieve script runs on a host with no access to the golden record and would otherwise compile to a rule that cannot match.
5. **`compile_sieve` returns `Result`.** The spec's signature shows a bare `SieveScript`, but its own acceptance requires a typed refusal for non-mail predicates.
6. **The ambiguity band is closed at both ends,** default low 0.0. An exclusive lower bound skipped a dead tie, which is the most ambiguous case there is.

## Supersession

This work supersedes the policy layer in `commonplace::organize`. Its
`OrganizeDecision::NeedsYou` and `FiledForReview` variants are precisely the
"pending review" state this spec's first design law abolishes. The ranked
candidates that module computes remain useful and tier 1 consumes the same
ingest embeddings, so the classifier is reused rather than replaced. The
`RoutingRule` shape there, which had no persistence, is the ancestor of tier 0's
`Rule`, which does.
