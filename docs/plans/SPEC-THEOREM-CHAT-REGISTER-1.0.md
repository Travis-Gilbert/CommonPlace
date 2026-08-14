# SPEC-THEOREM-CHAT-REGISTER-1.0

2026-08-05. `Travis-Gilbert/CommonPlace`, `Travis-Gilbert/Theorem`. Execution handoff. Deliverables
CH1 through CH8. This is the artifact CR-003 of `plan-theorem-chat-register-20260805a` names; its
acceptance is that spec's acceptance. This is an execution handoff; CONVENTIONS.md applies in full.

The verdict: the chat register is one package, `packages/chat-register`, stamping
`data-register-impl="theorem.chat"`, mounted by two hosts, the Studio auxiliary-bar view and the
console `/chat` route, speaking to Theorem through the harness session door and ACP, with no
openwork, opencode, or AnythingLLM dependency on the product happy path. Its floor is the canvas
substrate: the chat page is a canvas document, the transcript is a lane on it, and anything pulled
onto the screen is a graph object in the agent's context. One law governs the whole register:
**on-screen and in-context are the same visible fact.**

Companions. CR-001 and CR-002 of the same plan gate the live acceptances here: Copilot retirement
clears the Studio panel this register mounts into, and the workspace volume repair gives sessions a
real shared checkout. The Cursor-owned plan removing openwork and AnythingLLM owns those
deletions; this spec records the inventory and references their completion rather than duplicating
the work. SPEC-COMMONPLACE-WORKBENCH-CONVERGENCE thinking (two hosts, one registry) is applied
here rather than restated.

## Verify first

- CR-001 and CR-002 status at execution time; CH5 and CH6 do not claim live acceptance while
  either is red.
- The token artifact's location and completeness: the Zed-derived light and dark palettes as they
  exist in the repo today, since named choice 2 makes them the single source. Record where they
  live before CH2 points anything at them.
- The canvas substrate package as #145 left it: the node-kind registry and edge language, and
  whether a transcript lane and a node-limited region fit the current kinds or need new kinds
  registered. New kinds are registered, never special-cased.
- The harness session door the composer binds: `THEOREM_ACP_WS_URL`, `THEOREM_NODE_URL`, and
  `THEOREM_API_TOKEN` per `railway.console.toml`, and what the hosted ACP session actually
  supports today for permission prompts and todo streams.
- assistant-ui's current version and the stability markers on AssistantTransport and the external
  store path; anything `unstable_` gets pinned and recorded, not assumed.
- AI Elements registry installation into the pnpm workspace: confirm the shadcn registry flow
  lands source under the package rather than under an app, so both hosts consume one copy.
- The Studio webview asset pipeline: the package's build output consumed through `asWebviewUri`
  under the webview CSP, verified with a smoke before CH5 promises a mount.
- The retirement inventory's ground truth by search, not memory: every import of `apps/chat`,
  `apps/chat-server`, opencode SDKs, and AnythingLLM remnants, so CH8's list is complete on the
  day it lands.

## Named choices

1. **One package, two hosts.** `packages/chat-register` builds once and mounts in the Studio
   auxiliary bar through a `WebviewViewProvider` and at the console `/chat` route. Host adapters
   stay thin: transport injection, auth, deep links. Any capability that exists in one host and
   not the other is a recorded gap, never an accident.
2. **The token generator is retired; the token constitution is not.** The generator never worked,
   which under the cutover's own law made it fake liveness, so it is deleted with a manifest entry
   like any other corpse. Its replacement is a hand-authored artifact: one `theme.css` carrying
   the Zed-derived light and dark palettes as CSS variables, which Tailwind 4 consumes natively,
   the twenty-ui fork's theme constants are pointed at by hand once, and the Studio color theme
   JSON is authored from by hand once. Static files whose effect is observable, one source of
   truth, `gate:register` still refusing arbitrary values. Palette values are uncopyrightable;
   Zed's CSS is not copied, its measurements are.
3. **The floor is the canvas substrate.** The chat page is a canvas document on the same node-kind
   registry and edge language as the programmable graph. The transcript is a lane; objects pulled
   in are nodes; the workflow view above the composer is a node-limited region with the same
   contract as the full canvas, its limit being view configuration, never a second engine. "Open
   full" is a deep link to the canvas register carrying the same object ids.
4. **Context is legible and reconciled.** Every canvas object carries an explicit in-context
   state; the context count the Inspector shows is computed from the same store the canvas
   renders; agent-initiated additions land as visible objects with receipts. Divergence between
   what is shown and what is in the brief is a bug by definition.
5. **The composer is assembled, not adopted.** assistant-ui's runtime layer owns threads,
   branching, editing, and tool round-trips, bound to the harness session door through the
   transport the Verify first item confirms; AI Elements vocabulary renders messages, reasoning,
   tool calls, confirmations, tasks, and sources; the Skiper-style skin is reimplemented under
   tokens, its animated placeholder, auto-resize, and pill springs kept, its hardcoded values
   left behind, which `gate:register` enforces mechanically.
6. **The scrubber is a shared package.** `packages/chapter-scrubber` lands adopted nearly as-is
   with a chapters-provider contract; this register ships the chat-turns provider with
   `currentIndex` bound to the agent's position. Other registers add providers in their own specs.
7. **Sessions bind the shared checkout.** A session opened in either host works against
   `/workspace/repo`, the same tree the IDE door serves, so an edit reviewed in chat is the edit
   the editor shows.
8. **Non-goal, restated from the plan's deferral D1:** Theorem as `IDefaultChatAgent` is not
   attempted without the Chat participant and host APIs; the stock chat surface stays retired and
   the register UI is the agent surface.

## Deliverables

### CH1. The package skeleton and register stamp

Path: `packages/chat-register`.

The package builds in the pnpm workspace, renders a session shell stamping
`data-register-impl="theorem.chat"`, and carries the host adapter seams with no host code inside
the package.

Accepted when the package builds and its test renders the stamp, and a grep shows no import from
`apps/` inside the package.

### CH2. The token artifact cutover

Paths: the theme artifact per Verify first, the twenty-ui fork's theme constants, the Studio theme
extension, the deleted generator.

`theme.css` becomes the single source: light and dark, consumed by Tailwind in this package and
the console, pointed at by the twenty-ui constants, and transcribed into the Studio color theme
JSON set as default with users free to switch. The generator is deleted with its manifest entry
and a resurrection smoke.

Accepted when computed styles in both hosts resolve to the artifact's values in both schemes, the
Studio default theme matches the same palette, the generator's paths are gone, and `gate:register`
still passes with zero arbitrary-value classes.

### CH3. The canvas floor

Paths: `packages/chat-register`, the canvas substrate package.

The chat document as a canvas document: transcript lane, object drop and connect, per-object
in-context toggles, and the reconciled context count per named choice 4. New node kinds registered
in the substrate, not local to this package.

Accepted when dragging a fixture record onto the chat raises the context count by one and the next
session turn's brief demonstrably contains it, receipt retrievable; toggling it out lowers the
count and the next brief omits it; an agent-added object appears on canvas with its receipt.

### CH4. The composer and transcript

Path: `packages/chat-register`.

The assembled composer per named choice 5 and the transcript rendered in AI Elements vocabulary:
streaming text, reasoning, tool calls with receipts, confirmations wired to harness permission
prompts, todos as tasks, attachments. The scrubber package lands beside it with the chat-turns
provider.

Accepted when a live session streams a turn with a tool call and its receipt renders, a permission
prompt round-trips through the Confirmation surface, the scrubber navigates a long fixture
transcript to an exact turn, and the package contains no hex literal outside the token artifact.

### CH5. The Studio mount

Paths: `apps/theorem-vscode`, `packaging/commonplace-studio`.

The auxiliary-bar view hosting the package through the webview pipeline, ACP session against the
shared checkout, deep links from tool receipts to files opening as editor tabs.

Accepted when a signed-in `/IDE` shows the register in the agent panel region with no Copilot
sign-in wall, `theorem.startSession` completes against `/workspace/repo`, and a receipt's file
link opens the file at the line in the editor.

### CH6. The console mount and the swap

Paths: `apps/console/src/views/registry.tsx`, `.commonplace-canonical`, middleware.

`/chat` serves the package under console session auth, the manifest row flips to `theorem.chat`,
and the swap commit names `openwork.chat` as displaced per the swap rule.

Accepted when the live `/chat` stamp is `theorem.chat`, the doctor and register-manifest checks
are green, and the swap commit's message names the displacement.

### CH7. The workflow view

Paths: `packages/chat-register`, the canvas substrate.

The node-limited canvas region above the composer, labeled Workflow, same contract as the
programmable graph, with the n8n-style block's shape rebuilt on the substrate rather than its
demo code, drag without per-frame forced sync, colors from tokens, "open full" deep-linking to
the canvas register.

Accepted when a workflow sketched in the view exists as a graph object queryable through the
harness, reopening the chat restores it, the full canvas opens it by deep link, and drag
performance shows no forced synchronous layout per frame in a profile.

### CH8. The retirement inventory and supersession record

Paths: `docs/plans/theorem-chat-register/`, the manifest.

The inventory per CR-003's acceptance: `openwork.chat` as register impl, `apps/chat` and
`apps/chat-server` as product chat host, opencode SDK reachability from the product happy path,
and AnythingLLM leftovers, each entry naming its owner, this spec's swaps or the Cursor-owned
removal plan, and its verification. The OW-series specs gain supersession notes per deferral D2.

Accepted when the inventory exists with every entry owned and verified or explicitly pending with
its owner named, no product route serves openwork as the chat register, and the manifest carries
the retirements.

## Out of scope

Theorem as `IDefaultChatAgent` (deferral D1); voice; the full Cowork mode presentation; canvas
capabilities beyond the lane, the drop-and-connect contract, and the workflow view; the openwork
archive pass (deferral D2); mobile polish beyond what the responsive package already gives;
Symphony. Each is its own handoff; none gates anything above.

## Reporting

Per CONVENTIONS: scannable status per deliverable, acceptance verified or not and how, leading
with what is not done. Include the token artifact's location as found, the assistant-ui transport
chosen with its stability markers, the new node kinds registered, both hosts' live stamps, the
context-reconciliation demonstration, and the full retirement inventory with owners.
