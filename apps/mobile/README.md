# CommonPlace Mobile

The mobile face of Theorem's Harness (SPEC-MOBILE-APP): capture that is trusted
instantly, an Index made for a phone, chat with scenes, a viewport into agent
rooms, a data browser, and reminders that actually fire.

Expo SDK 57 / expo-router / TypeScript / NativeWind v4. Plan and checklist:
`docs/records/004-mobile-app.md` and `.harness/checklist.json` at the repo root.

## Anatomy

- `src/theme/` - porcelain register v2 tokens (tonal elevation, oxblood primary,
  umber machine surfaces). `tokens.ts` is the single source; `src/global.css`
  mirrors it for NativeWind classes.
- `src/api/` - instance seam (secure-store settings + `{ __typename }` probe),
  GraphQL client against commonplace-api (`x-api-key`), harness-server REST+SSE
  rooms client, gateway scene client.
- `src/capture/queue.ts` - the capture trust loop: SQLite-durable queue, state
  machine kept -> syncing -> filed/answered, blob upload path.
- `src/components/omnibar/` - the FAB-opened sheet for capture AND ask. Keep is
  the default verb; Ask arms explicitly and never auto-routes.
- `src/components/nav/TabBarWithFab.tsx` - tab pill (Index, Chat, Commonplaces,
  Data) + detached 56pt oxblood FAB, right thumb zone.
- `src/notifications/` - the notification ethics, enforced as law: reminders,
  approvals, mentions, asked-for run-finished. Nothing else. No badge, ever.
- `src/app/` - expo-router tree: `(tabs)/` + `object/[id]` drawer, `room/[id]`
  feed, `thread/[id]` chat, `scene` WebView sheet, `account` sheet.

## Run

```bash
npm --prefix apps/mobile run start      # from the repo root, or:
cd apps/mobile && npx expo start        # then i / a for a simulator
npx tsc --noEmit                        # type gate
npx expo export --platform ios         # bundle gate
```

Point the app at a node under Account (avatar on Index): commonplace-api URL +
API key, optional gateway URL (scenes) and harness node URL (rooms).
