# Console Island Shell: report

Source: `HANDOFF-CONSOLE-ISLAND-SHELL` (remodel; wins over amendment 35
Manrope headers and nested card container paint).

## Status lead

Acceptance evidence is on disk under `docs/plans/console/island-shell/`.
Live GraphQL upstream was 502 during capture (status bar Disconnected);
island chrome still rendered from the local layout seed.

## Acceptance evidence

| Criterion | Result |
| --- | --- |
| Three islands, two base classes, consistent headers | Pass: Files/Context/Thread (`tool`) + editor (`editor`); titles IBM Plex Sans 36px, not mono. Shot: `acceptance-three-islands.png` |
| Error once (body + footer) | Pass on `/cards`: body notice without raw message; footer `View query failed.` once; Retry in footer. Shot: `acceptance-error-once.png` |
| Chrome labels not mono | Pass: `[data-island-title]` is IBM Plex Sans. Grayscale capture: `acceptance-grayscale.png` |
| CardView / RecordTableView no container chrome | Pass: no island/nested-card container paint; row hover/selection paint allowed |
| Window inactive 0.44 overlay | Pass: MaterialLayer `inactiveAlpha` when `data-window-inactive`; no DOM `::after`. Shot: `acceptance-inactive-overlay.png` |
| Homogeneous island gate | Pass (`npm run gate:islands`) |
| Gates | Pass (`npm run gates`) |

## Shipped

| ID | State |
| --- | --- |
| IS1 | `IslandShell.tsx` with header/body/footer, densities, material `data-island` registration |
| IS2 | Header/footer tokens; contrast pairs; manifest regenerated |
| IS3 | `ViewStates` shell mode; error once; tests |
| IS4 | `CardView` + `RecordTableView` container chrome removed |
| IS5 | Grid helpers + dnd-kit handles; inactive wash in MaterialLayer |
| Follow-up 2 | Acceptance 4 tightened: ban container chrome, allow interaction paint |
| Follow-up 3 | `kindGlyph` + `bodyBleed` on `BlockPresentation`; host reads descriptor |
| Follow-up 4 | `hasHomogeneousIslandDefect` + `gate:islands` |
| Follow-up 5 | `bodyBleed: flush` for records/terminal/browser |
| Follow-up 7 | DOM `::after` removed; inactive owned by MaterialLayer |

## Remodel overrides

- Island titles: IBM Plex Sans 15/600 cozy, 13/600 compact (not Manrope)
- Compact header: 30px
- Tool windows no longer own `data-island`; `IslandShell` does
- Body flat: card/table views no longer paint nested raised containers

## Collateral

- Root `zustand` pinned to 5.0.14 so `@assistant-ui/core` can import
  `useShallow` (4.5.7 was blocking console boot).
