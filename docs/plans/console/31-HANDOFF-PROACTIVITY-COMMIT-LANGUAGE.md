# HANDOFF-PROACTIVITY-COMMIT-LANGUAGE

Repo `Travis-Gilbert/CommonPlace`, app `apps/console`, surface `console-proactivity`. Register: execution handoff; named choices are requirements. This is a presentation-language correction to the merged PR 63 surface. The backend contract (SPEC-PROACTIVITY-GRAPH-WIRING channels 1 through 4), the enumerated mutation surface, the receipts, the grant and budget boundaries, the PG gates, and the elkjs layered layout are all unchanged. What changes is the visual language of nodes and cards, per a direction that was given verbally and never entered the written record; this document is that record. Companions: 30-HANDOFF-PROACTIVITY-GRAPH (the implemented surface), SPEC-PROACTIVITY-GRAPH-WIRING, SPEC-AGENCY-PROPOSAL-KERNEL, 13-AMENDMENT (speaker registers, applied here), 14-HANDOFF-CONSOLE-DIMENSIONALITY (in force on this surface like every surface).

## The model: the standing program is a repository

The proactivity graph is a program with two authors, and git already solved how to render that. The mapping is exact, not decorative:

| Program concept | Git concept | Renders as |
|---|---|---|
| A watch, judgment, or response | A commit | Commit row: rail dot, short id, message, author, time |
| Authorship (yours, agent) | A lane (rail) | Rail color by speaker register |
| A watch joining stake and source streams | A merge commit | Two rails converging with the curved merge line |
| A stake | A ref (branch label) | Ref badge on the lineage it names |
| The active standing program | HEAD | The current tip; what runs |
| Disabling a node | A revert commit | The undo affordance already shipped is the revert |
| A plain-language compilation candidate (PG5) | Uncommitted work ahead of HEAD | Dashed candidate commits awaiting commitCompilation |
| A firing (channel 3 SSE why-trace) | An execution commit on the agent lane | Appends live, parented to the program commit that fired |
| A grant with expiry | A tag | Tag badge on the response commit it authorizes |
| Budget state | Ref decoration | The spend chip in the row, over-budget in warn |

Two things this buys, in the order you said them: a person can program the agent by adding commits, because the palette of addable commits is small and legible; and the system can show deterministically what the agent did, because execution is commits with lineage to their authorization. Authorship history and execution history become one visual language, which no boxes-and-arrows rendering can do.

## Named choices

1. Two upstreams adopt from the jal-co/ui shadcn registry, adopt-and-edit: `@jalco/commit-graph` supplies the graph language (rails, curved merges, commit rows, ref badges, popover detail) and `@jalco/repo-card` supplies the card language (title, description, dot, stat slots, topic chips, badge states, CVA variants). License verified at adoption per the verify-first row. Per decision 8's correction, supplied component code is the implementation starting point, never merely inspiration.
2. The graph view keeps React Flow and elkjs (the wiring spec's V11 stands; commit topology is layered by nature). What changes: every node renders as a commit row in the commit-graph visual language, and every edge renders as the component's curved rail bezier in the lane color of its target's author. No arrowheads; lineage flows by convention. The join renders as a true merge, two rails converging into the watch commit, which makes the banner sentence ("a watch fires only where both converge") a picture instead of a caption.
3. Rail colors are the speaker registers, not the component's 8-color cycle: your lane is human ink (oxblood family), the agent's lane is teal, derived watches (subKind derived) carry gold, the accent is reserved for selection, destructive red only for destructive. The registers amendment governs the exact values.
4. The typography law, and the defect it names: title face by author (Vollkorn for yours, IBM Plex Sans for the agent), body Plex Sans, machinery in JetBrains Mono (kind labels, short ids, spend counts, dates, source names). Variation by authorship is the system; variation by accident is a defect, and P4 adds the assertion that makes accidental variation fail CI. This resolves the current random font drift by making every face carry meaning.
5. The cards view renders in repo-card grammar, one card system with slots: a stake is the repository (title in author face, "rests on N assumptions" as the description, source chips in the topics slot, the author dot in lane color where the language dot sits, fire count and last-fired in the stat slots, the budget in the license slot, disabled rendered through the amber badge pattern the component already ships for archived, with the muted variant). Watches, judgments, and responses render as compact rows in the same grammar beneath their stake. The current hand-rolled card set is replaced, not restyled.
6. The commit palette is the programming affordance: Add watch, Add judgment, Add response, Add stake create candidate commits on your lane, dashed and ahead of HEAD, flowing through the existing PG5 compile-and-review path and landing through commitCompilation. Nothing about the mutation surface changes; the palette is a new door to the same enumerated set.
7. The dimensionality handoff applies here fully: register tokens only, the token manifest governs, no component-minted tokens, seams and headers per X3. Stripe icon work stays out per decision 12; this surface adds no glyphs.

## Deliverables

### P1. Adopt and retoken
Build: both components enter via the shadcn registry into the console's component tree, retokened to `--ij-*` and the speaker registers (their Tailwind classes re-pointed at register utilities; no raw palette survives), with the ledger rows updated to name them as the surface's upstreams.
Acceptance: both render in a fixture story on dark and light passing the register lint; the ledger names them; the license file is recorded in the ledger row.

### P2. The graph relanguage
Build: the React Flow node renderers replaced with commit rows (rail dot, mono short id derived from the node id, the decompiled sentence as the message in author face, author chip, relative time, ref badges for stake and grant and budget states); edge renderer replaced with lane-colored curved rails (extracting the rail-drawing approach from the commit-graph component or reimplementing its bezier language as React Flow edges, whichever the component's internals favor at read); the join merge treatment; selection and popover detail preserved; the fired-path lighting from channel 3 renders as the lineage glowing and an execution commit appending on the agent lane.
Acceptance: the five-minute scene reads as a commit graph to a person who uses git (hallway capture); the join renders as a visible merge of two rails; disabling a node appends a revert row and the undo affordance reverses it; a simulated firing lights the lineage and appends the execution commit; elkjs layering and all PG gates stay green.

### P3. The cards relanguage
Build: the cards view rebuilt on the repo-card grammar per named choice 5, sections preserved (sources, what matters, what it watches), all state chrome carried (permission "will ask you every time", grant with expiry, spend, degraded, over-budget) into the grammar's slots and badges.
Acceptance: every state visible in the current screenshots renders in the new grammar from the same fixture; disabled stakes show the amber badge and muted variant; no hand-rolled card component remains in the surface.

### P4. The typography law
Build: the author-face binding (title face resolves from the node's author field), the machinery-mono binding, and the lint assertion: a scan over the surface's rendered fixture asserting every text element's computed font-family matches the law's mapping for its role and author, failing on any element outside the mapping.
Acceptance: the assertion passes on the rebuilt surface and fails on a probe element with a mismatched face; the random variation visible in the current build is gone in the capture set.

### P5. Candidate and execution states
Build: the dashed candidate-commit rendering for PG5 output ahead of HEAD with commit and discard affordances mapping to the existing mutations; the execution-commit append on firing with its parent reference rendered; both against the existing ProactivityStore fixture seams so the wire swap later changes nothing visual.
Acceptance: compiling a plain-language intent renders candidates as uncommitted commits; committing lands them on your lane; discarding removes them; a fixture firing appends an execution commit parented correctly.

### P6. Gates
Build: regenerated baselines both themes at 1280 and 1440 including the merge join, a candidate state, and a lit firing; the P4 assertion in CI; and the PR 63 follow-up folded in: the linux baselines harvested from the CI artifact set and committed so the visual gate runs green on ubuntu.
Acceptance: CI green including the visual gate on ubuntu; the capture set is the new reference for the surface.

## Verify first

- The jal-co/ui license at the adopted version (the registry publishes open source; record the exact license text in the ledger).
- The commit-graph component's internals: whether its rail renderer extracts cleanly for React Flow edges or the bezier language is reimplemented against its output as the fidelity reference.
- The shadcn registry add path against the console's setup (the console has not consumed a shadcn registry yet; the components land in-tree either way).
- The ProactivityStore's candidate and firing fixture shapes against P5's needs.
- 30-HANDOFF-PROACTIVITY-GRAPH's acceptance set for any assertion this relanguage invalidates by design (the register-conformance and altitude gates stand; any box-rendering assertions update to commit-row equivalents).

## Out of scope

The wiring channels and their swap from fixtures to live (the wiring spec owns it), the kernel, any mutation-surface change, the sentence altitude (unchanged), and the aliveness engine itself.

## The drift lesson, recorded

The direction this document encodes was given verbally and lost between sessions; the surface that shipped was faithful to its written spec and wrong about the intent. The standing rule this confirms: a component direction is not given until it is a ledger row or a spec line, and when the harness's encode path is live, decisions of this kind flush there the day they are made.
