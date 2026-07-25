# Console Island Shell: implementation plan

Source: `HANDOFF-CONSOLE-ISLAND-SHELL` (decided 2026-07-20). Remodel
precedence: where this handoff conflicts with amendment 35, tool-window chrome,
or nested card surfaces, this handoff wins.

## Order

1. IS1 `IslandShell` + `surfaceClass` on `BlockPresentation` + island grid helpers
2. IS2 header/footer tokens, bridge aliases, contrast pairs, manifest
3. IS3 `ViewStates` shell consumption (loading/empty/error/stale; error once)
4. IS4 migrate `CardView` + `RecordTableView` (delete container paint)
5. IS5 grid mounts, dnd-kit drag handle, resize snap; window inactive overlay
6. Wire `ViewInstanceHost` / tool windows through the shell where island-mounted

## Status lead

Not done at plan open: IS1 through IS5.
