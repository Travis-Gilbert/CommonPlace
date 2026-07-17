# DESIGN-MOBILE-COMPANION

Register: design brief, pre-handoff. The mobile app's product thesis and architecture. Base: the existing Expo app at `apps/mobile` (Expo plus NativeWind, currently bare, which is the right starting condition). Companions: HANDOFF-CONSOLE-IA (the organs and their names), DESIGN-HARNESS-SIGNAL-PIPELINE (mobile is a signal-rich surface), DESIGN-THEOREM-URI (the scheme mobile registers), SPEC-HARNESS-MEMORY-PROJECTION (the read seams), SPEC-AGENCY-PROPOSAL-KERNEL (the agency loop; section 5 of this brief). NORTH-STAR-LIFE-LOOP and HANDOFF-VERIFIED-COGNITION are named companions pending re-receipt; their mobile implications fold in when they land.

## 1. Thesis

The console is where work happens; mobile is where life happens. The phone is the field organ: capture what you encounter, triage what arrived, talk to the harness, read what it prepared, approve what it proposes, and be told when something you delegated finished. Mobile is not the IDE in a small window, and it never tries to be.

The pronoia framing applies directly: the phone is where the feeling "something capable is working in my favor and I can see it" pays off, because it is where you are when you are not working. The agency kernel sharpens this into the product's strongest scene: wake up, five cards, everything prepared, nothing committed without you.

## 2. What mobile is not

No tool windows, no shell, no record tables at density, no Model surface, no Survey in v1, no code editing. Every one of those has a home on the console; forcing them onto a phone would spend the register's credibility to gain nothing.

## 3. Architecture

1. One contract, two renderers. `packages/block-view` is platform-agnostic TypeScript; mobile registers React Native descriptor implementations against the same contract the console uses. A `card.compact`, a `chat.thread`, a `markdown.doc`, and the proposal card exist once as descriptors and twice as renderers. No mobile-only object model.
2. The thread rides the same ambient runtime pattern over the hosted ACP wire the console chat uses (PR 55 lineage). assistant-ui's React Native surface is the named intent; its current existence, package name, and parity are the first verify-first row, and the runtime abstraction is the hedge: if the RN surface is thinner than the web one, the thread renders through the same runtime with locally built primitives.
3. Data through the same seams: the data API for objects, the changefeed for freshness, tiered reads (gist on cell, full on open) applying the lean-projection economics to mobile bandwidth by construction.
4. `theorem://` registers through Expo linking. A shared address opens the object in the app; the app emits addresses from every share affordance.
5. Offline first where it matters: the capture queue writes locally (expo-sqlite) and syncs through the ingestion path when connectivity returns. Reading caches the last N opened documents. Everything else is honest about being online. Approvals are never offline: an approval requires a live preflight, so an offline approve affordance does not exist.
6. Push through Expo notifications, governed by the kernel's capability split (section 5.3). Notification pressure defaults quiet.

## 4. Surfaces, v1

1. Capture: the share sheet target (URL, text, image), a quick note composer, and camera capture, all landing as ingestion with provenance. Capture works offline and shows its queue.
2. Chat: the thread plus a compact Composer (the same organ at phone density, attach and `@` mentions included, the mark composing). Voice input enters here when it enters at all.
3. Triage: the Index Needs-you queue as a card stack. Accept, override with the Fix sheet, dismiss. Every swipe is a labeled signal per the signal pipeline, which makes mobile the highest-volume training surface in the product almost for free.
4. Reader: briefs and memory documents in a reading register derived from markdown-theory tokens rendered through native styles (the proportion values consumed as numbers; no web CSS dependency). Documents arrive by notification, by address, or from the triage stack.
5. Home: a single glanceable screen: the Briefing when one exists (section 5), presence of running work (rooms and runs as quiet rows), capture affordance thumb-reachable.

Navigation is native tabs (Home, Chat, Capture, Triage, Reader appears contextually), thumb-zone laid out, no hamburger, no stripe cosplay.

## 5. The agency loop (why the kernel makes mobile agency possible)

SPEC-AGENCY-PROPOSAL-KERNEL is a mobile spec wearing an engine spec's clothes. Its five-minute test opens with a phone scene, and its safety architecture is precisely what makes a phone a legitimate approval device rather than a dangerous one.

1. Exact approval is phone-sized by construction. An approval binds proposal id, payload hash, effect-contract hash, precondition hash, target, and expiration; the executor recomputes hashes before committing and refuses on drift. That property is what makes approving from a pocket safe: the card the thumb approves is cryptographically the act that occurs, or nothing occurs. Without exact approval, mobile agency would be a liability; with it, the phone is the natural home of the authorization moment. The mobile proposal card renders the kernel's full field set (what changed, why, evidence, assumptions, prepared artifact, reversibility with the visible-artifact disclosure line, permission state, expiration) with approve, edit, dismiss, suppress; approve runs the live preflight and shows the postcondition receipt land.
2. The why-trace ships as the shared component (RS1's named reusable component) in both renderers. On the phone it is the trust gesture: tap an evidence chip, land on the archived source; expand why, see the assumption environments and any disagreeing annotation; frontier-honest wording renders wherever a label is incomplete. Verifier and solver receipts render as the verified state on the card (the verified-cognition surface, detailed when that handoff re-lands).
3. Notifications inherit the kernel's capability split instead of a volume slider: `notify:digest` and `notify:push/*` are distinct capabilities, separate from every action permission; no push ever fires without a prepared payload behind it; a dismissed basis hash never resurfaces; only a material change (new basis) can bring an item back, with the change named. This turns the brief's earlier "defaults quiet" into an enforceable contract: the phone interrupts only when tapping through lands on something prepared.
4. The Briefing is Home's morning form: the kernel's Part B slice rendered mobile-first, capped short list, everything-else toggle, honest silence when nothing qualifies (a morning with no cards renders the designed empty state and invents nothing). The reference executors land in their console slice first; mobile renders the same proposal objects through the RN descriptor.
5. Attention signals live here. Opened versus ignored, dismissed, "tell me sooner," "do not show again" are the Attention posterior's food, and the lock screen is where they occur. Mobile is thereby the primary training surface for the kernel's Attention dimension, exactly as triage swipes are for filing; both flow through the signal pipeline with the kernel's reward-vector discipline (no scalar collapse).
6. Grant proposals render on mobile but signing is deliberate: a proposed grant (promotion) presents as a full-screen review, never a card-stack swipe. Broadening standing capability is not a flick gesture.

## 6. Register

One material system continues, adapted rather than transplanted: the Int UI ladders (color steps, type scale, spacing rhythm, the gold and accent semantics) consumed as design tokens in NativeWind, with native platform navigation and gesture conventions. Dark and light follow the system. The mark renders where agent activity renders; no spinners, same rule as the console. Proposal cards carry the accent slot for pending approval and gold for learned judgments, the same grammar as everywhere.

## 7. Staging

1. v1: Capture, Chat, Home, notifications on the kernel's capability split, theorem:// registration.
2. v2: Triage with signals, Reader, offline capture queue hardening, the Briefing rendering proposal cards read-only with dismiss and suppress (attention signals begin).
3. v3: Exact approval on mobile (approve and edit paths live once the kernel's AK4 and the reference executors are landed and the console slice has proven the flow), Cards browsing, a Survey glance view, voice capture.

## 8. Verify first

- assistant-ui React Native: package, version, and what it actually ships today versus the web surface. This is the load-bearing unknown and it gates the Chat surface's build shape, not its design.
- The current `apps/mobile` contents in `src/` (bare confirmed at the tree level; inventory what exists before writing over it) and its Expo SDK version against current.
- Share-sheet ingestion mechanics on iOS and Android under Expo (share extension support and its constraints).
- Push infrastructure: Expo push service versus direct APNs and FCM, where the aliveness event stream terminates today, and where the kernel's notification capabilities will be enforced server-side.
- markdown-theory token consumption as numbers in RN styles (the tokens API exposes the computed values; confirm the import shape).
- The hosted ACP wire from a mobile client: auth posture and reconnection behavior on flaky networks.
- Kernel dependency status: AK1 through AK7 and the console reference slice (Part B) are prerequisites for staging item v3; the mobile Briefing in v2 needs only proposal objects readable through the data seam.
- NORTH-STAR-LIFE-LOOP and HANDOFF-VERIFIED-COGNITION contents on re-receipt; sections 5.2 and 7 take their detail.
