# SPEC-COMMONPLACE-PRODUCTION-CUTOVER-1.0

2026-08-03. `Travis-Gilbert/CommonPlace`, `Travis-Gilbert/Theorem`. Execution handoff. Deliverables
GL1 through GL9.

The verdict: the system's disease is that every layer ends at write-issued instead of
effect-observed, so this spec's one law is that nothing here accepts anywhere except the
production boundary. Every deliverable proves itself against `https://v2.theoremharness.com` or a
named live service URL. Repo-local evidence, typechecks, greps, and bundle scans are necessary and
never sufficient. The spec has two movements: turn the lights on, then take the corpses out, and
it ends by amending the conventions so no future spec can finish invisible. This is an execution
handoff; CONVENTIONS.md applies in full.

Companions. This spec grants the OW5 go-ahead that SPEC-COMMONPLACE-OPENWORK-FORK-1.0 paused for,
executes OW4 and OW7 at the boundary, and carries the merged vscode-surface pack into visibility.
Shell coherence across the registers, the shared chrome, switcher, and navigation grammar that
keep a VS Code editor, a Twenty-shaped canvas, and a cowork surface from feeling like three
products, is explicitly not this spec: it is named as the follow-on,
SPEC-COMMONPLACE-SHELL-COHERENCE-1.0, and sketched in Out of scope so the thought survives.

## Verify first

- Re-enumerate open PRs and live branches at execution time. As of 2026-08-03 the shelf holds #159
  (shared editor model seam), #160 (workspace readiness in shell), #162 (vscode-surface pack and
  fork); the numbers will drift, the obligation to empty the shelf will not.
- Which Railway services exist and which `railway.*.toml` each one uses (`railway.toml`,
  `railway.console.toml`, `railway.server.toml`, `railway.collector.toml`), and which service
  actually serves `v2.theoremharness.com` from which app. The assumption is `apps/console`;
  confirm it, since a wrong assumption here invalidates every acceptance below.
- Whether `apps/commonplace-api` is deployed anywhere today, and if so where; the
  workspace-substrate spec already flagged that its hosting had to be confirmed before wiring.
- The current contents of `.commonplace-canonical` (171 bytes at root) before growing it into GL1.
- The full legacy inventory by audit, not memory: `registry.tsx`'s current register-to-view
  mapping; the Models register opening a legacy document editor; the `/Data-model` plan-id
  surface; the assistant-ui chat set under `apps/console/src` (`ChatPage`, `Composer`,
  `RuntimeComposer`, `Transcript`, `runtime`, `ThreadView`, `ThreadListView`); `apps/web`; and
  anything else `registry.tsx` or the router serves that the manifest will not name canonical.
- The unrecorded OW4 route-versus-zone decision; it gets made in GL6 and written down.
- Cookie and domain constraints for console-session auth across whatever GL6 chooses, since a
  zone on a different origin breaks the one-sign-in acceptance.
- The harness degraded-write bug's status. Until writes stop reporting failure while landing, the
  doctor trusts direct observation only, per named choice 3.

## Named choices

1. **The manifest is the authority and the registry obeys it.** `.commonplace-canonical` grows
   into the register manifest: for each register, the canonical package, its production route, its
   `registry.tsx` entry, and every superseded implementation with a deletion deadline. A CI check
   fails when the registry and the manifest disagree. The swap rule binds from GL1 onward: an
   addition to the registry must name what it displaces, and a swap is one commit, never
   add-now-delete-someday.
2. **Acceptance lives at the production boundary.** Every deliverable's acceptance names a live
   URL and what an observer sees there. A deliverable whose evidence is only repo-local is not
   done, whatever else is true.
3. **The doctor observes; it does not believe.** Liveness and canonicity are asserted by direct
   HTTP responses and DOM markers, never by harness receipts, so the doctor stays valid while the
   degraded-write bug is open. Receipts join later as corroboration, not foundation.
4. **Deletions are deliverables.** A retirement carries its own acceptance, including a
   resurrection smoke that fails if the corpse returns. "Removed" means the doctor goes red when
   it comes back.
5. **The OW5 go-ahead is granted by accepting this spec.** Deploying the workspace container is
   outward-facing and was correctly paused; this document is the recorded approval.
6. **Every view names itself.** Each mounted register view emits a `data-register-impl` attribute
   carrying its manifest identity, which is what the doctor reads and what makes legacy
   impersonation impossible for the next session and the next reviewer, human or model.
7. **Env truth stays honest.** The no-defaults-that-fake-liveness contract in
   `railway.console.toml` is preserved exactly; this spec lights the variables, it never softens
   the emptiness that unset variables render.

## Deliverables

### GL1. The register manifest

Path: `.commonplace-canonical` grown in place, plus the CI check beside it.

The manifest rows for every register the console serves: chat, records, data model, documents,
editor, plan, runs, and whatever the Verify first audit adds. Each row: canonical package,
production route, registry entry, superseded implementations, deletion deadline. The CI check
compares `registry.tsx` against the manifest on every push.

Accepted when the manifest exists with one canonical implementation per register, the CI check is
green on main and demonstrably red on a branch that adds a registry entry without a manifest row,
and every superseded implementation found by the audit appears in a row with a deadline.

### GL2. Upstream services lit

Paths: the Railway project, service configs per Verify first.

The four upstreams the console's env contract points at, confirmed answering: the CommonPlace
consumer GraphQL host, the object-seam data API required by the Railway launcher, the harness HTTP
surface, and RustyRed's `/v1/proactivity/stream`. Each recorded with its production URL in the
manifest's service section. Where a service is not deployed, this deliverable deploys it; the
GraphQL endpoint that has been failing gets diagnosed here, at its own boundary, before the
console is blamed for rendering its absence.

Accepted when an unauthenticated health probe and an authenticated smoke succeed against each of
the four URLs from CI, and the manifest records the URLs.

### GL3. The console env contract, set and redeployed

Path: the Railway console service.

The full block from `railway.console.toml`, verbatim names: `THEOREM_GRAPHQL_URL` and
`THEOREM_API_KEY`; `CONSOLE_DATA_API_URL` and `CONSOLE_DATA_API_KEY`; `CONSOLE_HARNESS_URL`,
`CONSOLE_HARNESS_TOKEN`, `CONSOLE_HARNESS_TENANT`, `CONSOLE_HARNESS_ROOM`;
`NEXT_PUBLIC_CONSOLE_CHAT_URL`; `THEOREM_NODE_URL`, `THEOREM_ACP_WS_URL`, `THEOREM_API_TOKEN`;
`CONSOLE_MOBILE_API_KEY` where applicable; `THEOREM_PROACTIVITY_CHANGEFEED_URL` pointed at
RustyRed, never at the GraphQL host, exactly as the config file warns.

Accepted when, at `v2.theoremharness.com`, the composer renders in the chat surface, a record
table loads rows, the plan surface populates from the substrate, the runs rail leaves its
unavailable state, and the status bar no longer reads context or spend unavailable; each observed
in that order and screenshotted into the build report.

### GL4. The doctor

Paths: `scripts/doctor.sh`, a `/doctor` route in the console, and the CI job that runs both after
every deploy.

The script and the page assert, against the live URL: every env var in the GL3 block lit or
honestly reported down; every manifest route returning 200 and serving a view whose
`data-register-impl` matches the manifest's canonical entry; every retired implementation absent.
The page renders the same assertions a human can glance at.

Accepted when the doctor is green on the cutover state, demonstrably red when one env var is unset
in a staging test and when a legacy impl is deliberately re-routed in a staging test, and the CI
job blocks a deploy from reporting success while the doctor is red.

### GL5. Empty the shelf

Path: the open PR set, re-enumerated at execution.

Every open PR is reviewed and merged, or closed with a written reason on the PR. Nothing remains
open past the cutover without a recorded blocker. For each merge, the surface it carries is either
visible at its manifest route or explicitly parked in the manifest with a reason, so
done-but-invisible cannot recur silently.

Accepted when the open-PR count is zero or every remaining PR carries a recorded blocker, and each
merged surface is observable at its route or parked by name.

### GL6. Route the registers

Paths: the console router, `registry.tsx`, and the serving decision for `apps/chat`.

The swaps, each one commit naming its displacement per the swap rule: the chat register serves the
vendored openwork surface at the chat route, executing OW4 with the route-versus-zone decision
made and recorded here, console session auth intact; the data-model register serves the OWOX model
canvas from `packages/model-canvas` in place of the legacy plan-id surface; the Models registry
entry stops resolving to the legacy document editor and points at its manifest-canonical view; the
merged editor-seam and readiness surfaces from the shelf mount where their specs said.

Accepted when the live chat route serves the openwork register with a working composer under one
sign-in, the live data-model route serves the OWOX canvas, the doctor confirms every route's
`data-register-impl` against the manifest, and each swap commit names what it displaced.

### GL7. The workspace container

Paths: `packaging`, the new Railway workspace service.

OW5 executed under the go-ahead this spec grants: one per-workspace image carrying the chat-server
door and the code-server door over a single checkout, workspace-scoped tokens, deployed as the
workspace service.

Accepted when, against the live service, an edit made through the IDE door is visible through the
chat register's file surface with no sync step, both doors authenticate with the same workspace
token, and the doctor lists the workspace service among lit upstreams.

### GL8. Retirements with teeth

Paths: per the Verify first legacy inventory.

The deletions, executed after their replacements are live per GL6: the assistant-ui chat set under
`apps/console/src` with its views; the legacy document editor the Models register served; the
legacy `/Data-model` plan-id surface; `apps/web`, whose standing removal commitment now names its
replacement, `apps/console`, satisfying the ledger rule; and every other manifest row past its
deletion deadline. Each deletion lands with its files removed, its imports gone, its manifest row
moved to retired, and a resurrection smoke added to the doctor.

Accepted when greps for the deleted modules return nothing, the routes that served them are gone
or redirect to their replacements, the doctor's resurrection smokes are green and demonstrably red
when a deleted path is restored in a staging test, and MODIFICATIONS or the manifest records every
deletion by name.

### GL9. The convention amendment

Paths: `CONVENTIONS.md`, plus amendment notes on the four in-flight surface specs.

Two sentences enter the conventions: the final deliverable of any spec that produces a
user-visible surface is its manifest row flipped and its production smoke green at a named URL;
and any spec that supersedes an existing surface carries that surface's deletion as a deliverable
with its own acceptance. The openwork, twenty-ui, vscode-surface, and symphony specs each gain a
one-line amendment binding them to it.

Accepted when the conventions diff is merged, all four specs carry the amendment line, and the
next surface spec written after this one contains a production-boundary deliverable without being
asked.

## Out of scope

Shell coherence, held for SPEC-COMMONPLACE-SHELL-COHERENCE-1.0, and sketched here only so the
shape is on record: what will bind the registers is one token truth, which is already law; a
persistent shell that never unmounts while center panes swap, carrying the register switcher, the
global palette, and the presence and runs strip; a navigation grammar where every object has a URL
and every register deep-links into the others, plan node to file and line in the editor, record to
chat context, run to receipt; and transition continuity, with selection and scroll surviving
register switches because session state lives in the graph rather than the pane. None of it gates
the cutover, and the cutover makes it buildable, because coherence work is unverifiable while
half the registers are unrouted.

Also out: new features on any register, the branded fork's web output replacing code-server (its
own V7 acceptance governs that swap), Theorem-side fixes to the degraded-write bug, and mobile.

## Reporting

Per CONVENTIONS: scannable status per deliverable, acceptance verified or not and how, leading
with what is not done. Include the confirmed service map from Verify first, the env block as set
with secrets redacted, the route-versus-zone decision, screenshots for each GL3 observation, the
doctor's green run with its two demonstrated reds, the deletion list, and the amendment diffs.
