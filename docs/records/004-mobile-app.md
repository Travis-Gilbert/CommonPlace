# 004: SPEC-MOBILE-APP — apps/mobile (Expo React Native)

Status: built (2026-07-03). All 18 checklist rows executed; test-verifiable rows
completed (Rust suites green both repos, tsc exit 0, expo export green); UI rows
are built with on-device verification pending (no simulator on this machine —
CLT only). Reconciled statuses: `.harness/checklist.json`.

Deviations decided during the build (details in Decisions below):
`expo-audio` replaces the spec's sunset `expo-av`; the template's
`reactCompiler` experiment is off (conflicts with NativeWind's
`jsxImportSource`); voice transcription is deferred (no transcription service
exists on any node; voice files as an audio capture); "register" on the account
sheet means instance URL + API key (commonplace-api has no user-creation
surface). Cross-repo note: CommonPlace's commonplace-api path-deps point at the
sibling Theorem checkout, which currently has another head's in-flight gepa
edits; the suites here were validated against the clean Theorem worktree. Source spec: SPEC-MOBILE-APP.md (Downloads) plus the
claude.ai porcelain-register-v2 decision (doc_070852d0d404a589), which overrides the
spec on four points and is treated as spec-level:

1. Primary action color is real oxblood `#7A2733` (pressed `#66202B`, dark fill
   `#8A3140`, washes `#F6E6E5` / `rgba(138,49,64,0.16)`), not burnt orange. The
   web alias `--cp-oxblood: var(--cp-burnt-orange)` in
   `apps/web/src/styles/commonplace-tokens.css:66` is a PR artifact and is broken
   as part of this work.
2. FAB is a right-side detached 56pt circle in the thumb zone; the tab pill holds
   Index / Chat / Commonplaces / Data. This replaces the spec's raised-center
   capture slot.
3. The FAB opens the omnibar: one bottom sheet for capture AND ask. Default
   submit verb is Keep (offline-durable SQLite queue; ingest classifies kind and
   the receipt shows what it became). Chip row: Ask, camera, file, voice, web.
   Ask arms explicitly; question-shaped text softly highlights the chip but never
   auto-routes. Long-press FAB = voice capture.
4. Palette = claude-crimson light values with oxblood as primary; destructive is
   ink `#141413`; warm dark family `#262624 / #30302E / #3A3A37 / #1F1E1D`; teal
   `#2D5F6B` secondary. "Tension" is substrate vocabulary; humans see
   "Conflicting evidence" / a "Needs your call" card.

## Grounded facts (recon 2026-07-03)

- Backend: commonplace-api GraphQL at `POST /graphql`, auth header `x-api-key`,
  default port 50090 (`apps/commonplace-api/src/serve.rs`). Mobile talks to it
  directly (no Next proxy). Instance seam pattern to port:
  `apps/web/src/lib/commonplace-instance.ts` (probe = `{ __typename }`, settings
  `{ mode, url, apiKey }`).
- Queries in play: `ingest`, `put_note`, `edit_item`, `items`, `item`,
  `collections`, `add_to_collection`, `search`, `ask`, `theoremAgent`,
  `briefing`, `organize`, `discover`, `vector_neighbors`.
- `ItemGql.due_at_ms` exists; `remind_at_ms` does NOT → added in this work.
- `IngestInputGql` is text-only → additive multipart blob route added for
  photo/file/voice capture.
- Rooms: theorem-harness-server (Theorem repo) REST + SSE:
  `GET /harness/rooms/{id}[/presence|/intents|/records]`,
  `POST /harness/rooms/{id}/messages` (tenant_slug, actor_id, message, urgency,
  mentions, metadata), `GET /harness/rooms/{id}/stream` SSE. No rooms-list route
  and no push sender → both added in the Theorem worktree.
- Scenes: gateway GraphQL `sceneForInput(input, scope, origin) -> { sceneId, url }`
  then `GET /scene/{id}` returns self-contained HTML (256KB inline soft limit) —
  rendered in react-native-webview. `theoremAgent` via commonplace-api returns
  text answers (no scene payload), so chat scenes are an explicit affordance that
  calls the gateway.
- Stack verified: Expo SDK 57 (scaffolded), RN 0.86, Reanimated 4.5 (CSS
  animations for WeaveSpinner), expo-share-intent v8 (peers `expo ^57`, no
  post-install patch), NativeWind 4.2.6, `expo-audio` replaces the spec's
  sunset `expo-av`.

## Checklist

Machine-readable mirror: `.harness/checklist.json` (repo root). Statuses are
reconciled there at session close.

| ID | Slice | Where | Acceptance |
|----|-------|-------|------------|
| PT-001 | Mobile token system: porcelain register v2, light+dark, typed `tokens.ts` + NativeWind v4 vars | apps/mobile/src/theme | Every color/space/type value in app code traces to a token; oxblood values exact; contrast math recorded |
| PT-002 | Break web oxblood alias (real `#7A2733` family) | apps/web/src/styles/commonplace-tokens{,-neutral}.css | `--cp-oxblood` no longer references burnt-orange; burnt-orange keeps machine-accent roles |
| PT-003 | Nav shell: tab pill (4 tabs) + detached 56pt FAB right, blur bar iOS / 85% tint Android, pressed states, haptics | apps/mobile/src/app/(tabs), src/components/nav | Tabs render porcelain; FAB in thumb zone; reduced-transparency fallback |
| PT-004 | Omnibar sheet: Keep default, chip row Ask/camera/file/voice/web, Ask arms bar, soft question highlight (never auto-route), paste detection, long-press FAB voice | apps/mobile/src/components/omnibar | Plain submit queues Keep offline; Ask requires explicit chip; clipboard offer appears when clipboard non-empty |
| PT-005 | Capture trust loop: expo-sqlite queue, visible state machine (Kept on this phone → Syncing → filed receipt), receipt echoes destination/tags/reminder, tappable refile | apps/mobile/src/capture | Airplane-mode capture survives kill+reopen; drains on reconnect without touch; receipt elements tappable |
| PT-006 | GraphQL client + instance seam: fetch client with x-api-key, secure-store settings, probe, cloud/local switch | apps/mobile/src/api | Probe against local node succeeds/fails correctly; settings survive restart |
| PT-007 | Index tab: three bands (What landed / What is open / What today holds), On-this-phone group, needs-you "Needs your call" card at top of open, swipe done/park/refile, pull-down search, zero counts/badges | apps/mobile/src/app/(tabs)/index.tsx | Bands render organize+briefing objects through kind renderers; no numeric badge anywhere |
| PT-008 | commonplace-api additive: `remind_at_ms` scalar (model+GQL+ingest NL date parse echo), `edit_item` gains status/due/remind | apps/commonplace-api (CommonPlace copy) | `cargo test` green; ingest of "call mom friday 9am" returns remind echo; drift vs Theorem copy surfaced |
| PT-009 | Chat tab: thread list + thread view + docked composer (attach, @-mention), theoremAgent ask path, scene affordance → gateway sceneForInput → full-screen WebView, text fallback always first | apps/mobile/src/app/(tabs)/chat.tsx | Answer renders text first; scene card → WebView sheet; WebView failure leaves text intact |
| PT-010 | Commonplaces tab: room list w/ presence, room feed (intents/messages/records), SSE live tail, composer POST message + @mentions, approval cards Approve/Deny inline | apps/mobile/src/app/(tabs)/commonplaces.tsx | Message a room and see it in feed via SSE; approval card round-trips; works against LAN node URL |
| PT-011 | harness-server additive: `GET /harness/rooms` list + Expo push (register tokens, send on mention/approval) | Theorem worktree apps/theorem-harness-server | `cargo test` green; rooms list returns rooms with activity; push send fires for mentions |
| PT-012 | Data tab: segmented lenses Objects/Files/Timeline/Graph (scene WebView) + object drawer (provenance, destination token, receipts, object-scoped composer) | apps/mobile/src/app/(tabs)/data.tsx | Any object from search/receipt opens same drawer; graph lens renders neighborhood scene |
| PT-013 | Reminders + notification ethics: local schedule from remind_at_ms, categories w/ snooze, deep link; ONLY reminders/approvals/mentions/asked-run-finished notify; no icon badge | apps/mobile/src/notifications | NL reminder fires with deep link; resurfaced items never notify; badge count never set |
| PT-014 | Accounts/avatar sheet: profile, instance switcher w/ probe, tokens in expo-secure-store, notification prefs, sign out drains-or-confirms queue | apps/mobile/src/components/account | Switch cloud↔local without reinstall; tokens survive restart; sign-out gate on non-empty queue |
| PT-015 | Share sheet: expo-share-intent → omnibar pre-filled (URL/text/image/file) | apps/mobile (app.json plugin + hook) | Shared link lands in composer with capture confirmed on screen |
| PT-016 | WeaveSpinner RN port placed on machine surfaces (ask pending, room feed load), gold-light glow, reduced-motion fallback | apps/mobile/src/components/WeaveSpinner.tsx | Renders w/ Reanimated 4 CSS animations; static node under reduce-motion |
| PT-017 | Blob capture seam: multipart `POST /ingest/blob` on commonplace-api (BlobStore + ingest) + client wiring for camera/file/voice | apps/commonplace-api + apps/mobile/src/capture | Photo capture queues offline and files with blob hash on sync; voice files as audio item (transcription = surfaced deferral) |
| PT-018 | Verification + docs: tsc, expo export, targeted tests (queue reducer, Rust date parse), records/README updates both repos | both repos | All checks green and reported honestly |

## Decisions

- **HTTP over ACP for v1 agent path** (spec "Verify first" asked to pick one):
  mobile calls `theoremAgent` via commonplace-api GraphQL, matching the web shell.
- **Rust API changes land in the CommonPlace copy** of commonplace-api (what
  `api:dev` runs); the Theorem copy is ahead on deps — drift surfaced in the
  final report, not silently reconciled.
- **Push**: real lock-screen approve/deny needs a push sender; harness-server
  gains an Expo Push relay (bounded, ~150 lines) rather than a full APNs stack.
- **Omnibar sheet is hand-rolled** on Reanimated (spring translateY) instead of
  @gorhom/bottom-sheet — avoids a Reanimated-4 compat risk for ~80 lines.
- **Voice transcription deferred** (no transcription service exists server-side);
  voice records and files as an audio capture. Surfaced, not hidden.

## Non-goals (spec-stated)

Home-screen quick-capture widget ("later" in spec), run-spawning UI beyond
hand-off, Code-the-workbench, full atlas graph (desktop).
