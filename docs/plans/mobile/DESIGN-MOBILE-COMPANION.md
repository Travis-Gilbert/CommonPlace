# DESIGN-MOBILE-COMPANION

Register: design brief, pre-handoff. The mobile app's product thesis and architecture. Base: the existing Expo app at `apps/mobile` (Expo plus NativeWind, currently bare, which is the right starting condition). Companions: HANDOFF-CONSOLE-IA (the organs and their names), DESIGN-HARNESS-SIGNAL-PIPELINE (mobile is a signal-rich surface), DESIGN-THEOREM-URI (the scheme mobile registers), SPEC-HARNESS-MEMORY-PROJECTION (the read seams).

## 1. Thesis

The console is where work happens; mobile is where life happens. The phone is the field organ: capture what you encounter, triage what arrived, talk to the harness, read what it prepared, and be told when something you delegated finished. Mobile is not the IDE in a small window, and it never tries to be.

The pronoia framing applies directly: the phone is where the feeling "something capable is working in my favor and I can see it" pays off, because it is where you are when you are not working.

## 2. What mobile is not

No tool windows, no shell, no record tables at density, no Model surface, no Survey in v1, no code editing. Every one of those has a home on the console; forcing them onto a phone would spend the register's credibility to gain nothing.

## 3. Architecture

1. One contract, two renderers. `packages/block-view` is platform-agnostic TypeScript; mobile registers React Native descriptor implementations against the same contract the console uses. A `card.compact`, a `chat.thread`, a `markdown.doc` exist once as descriptors and twice as renderers. No mobile-only object model.
2. The thread rides the same ambient runtime pattern over the hosted ACP wire the console chat uses (PR 55 lineage). assistant-ui's React Native surface is the named intent; its current existence, package name, and parity are the first verify-first row, and the runtime abstraction is the hedge: if the RN surface is thinner than the web one, the thread renders through the same runtime with locally built primitives.
3. Data through the same seams: the data API for objects, the changefeed for freshness, tiered reads (gist on cell, full on open) applying the lean-projection economics to mobile bandwidth by construction.
4. `theorem://` registers through Expo linking. A shared address opens the object in the app; the app emits addresses from every share affordance.
5. Offline first where it matters: the capture queue writes locally (expo-sqlite) and syncs through the ingestion path when connectivity returns. Reading caches the last N opened documents. Everything else is honest about being online.
6. Push through Expo notifications, fed by the aliveness event stream: delegated job completions, Needs-you arrivals above a threshold, sentinel fires. Notification pressure is a setting, defaulting quiet.

## 4. Surfaces, v1

1. Capture: the share sheet target (URL, text, image), a quick note composer, and camera capture, all landing as ingestion with provenance. Capture works offline and shows its queue.
2. Chat: the thread plus a compact Composer (the same organ at phone density, attach and `@` mentions included, the mark composing). Voice input enters here when it enters at all.
3. Triage: the Index Needs-you queue as a card stack. Accept, override with the Fix sheet, dismiss. Every swipe is a labeled signal per the signal pipeline, which makes mobile the highest-volume training surface in the product almost for free.
4. Reader: briefs and memory documents in a reading register derived from markdown-theory tokens rendered through native styles (the proportion values consumed as numbers; no web CSS dependency). Documents arrive by notification, by address, or from the triage stack.
5. Home: a single glanceable screen: presence of running work (rooms and runs as quiet rows), the day's brief when one exists, capture affordance thumb-reachable.

Navigation is native tabs (Home, Chat, Capture, Triage, Reader appears contextually), thumb-zone laid out, no hamburger, no stripe cosplay.

## 5. Register

One material system continues, adapted rather than transplanted: the Int UI ladders (color steps, type scale, spacing rhythm, the gold and accent semantics) consumed as design tokens in NativeWind, with native platform navigation and gesture conventions. Dark and light follow the system. The mark renders where agent activity renders; no spinners, same rule as the console.

## 6. Staging

1. v1: Capture, Chat, Home, notifications, theorem:// registration.
2. v2: Triage with signals, Reader, offline capture queue hardening.
3. v3: Cards browsing, a Survey glance view (clippings as a swipeable gallery, no canvas), voice capture.

## 7. Verify first

- assistant-ui React Native: package, version, and what it actually ships today versus the web surface. This is the load-bearing unknown and it gates the Chat surface's build shape, not its design.
- The current `apps/mobile` contents in `src/` (bare confirmed at the tree level; inventory what exists before writing over it) and its Expo SDK version against current.
- Share-sheet ingestion mechanics on iOS and Android under Expo (share extension support and its constraints).
- Push infrastructure: Expo push service versus direct APNs and FCM, and where the aliveness event stream terminates today.
- markdown-theory token consumption as numbers in RN styles (the tokens API exposes the computed values; confirm the import shape).
- The hosted ACP wire from a mobile client: auth posture and reconnection behavior on flaky networks.
