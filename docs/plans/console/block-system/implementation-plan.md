# Console block system: implementation plan

Source: `HANDOFF-CONSOLE-BLOCK-SYSTEM.md` (decided 2026-07-20). Copied to
`docs/plans/console/block-system/HANDOFF-CONSOLE-BLOCK-SYSTEM.md`.

## Supersedes (explicit)

Earlier islands-material choices that this handoff replaces:

| Prior | Now |
| --- | --- |
| Gutter ~10px (compact 8) | Gutter 6px |
| Darker frame in dark mode | Frame lighter than islands in dark; darker in light |
| Island strokes / seam borders as island edge | Island border color equals island background |
| Terminal bottom dock silhouette in web shell | Terminal is a declared block only; no dock until desktop |

## Order

1. B1 contract extension (`packages/block-view`)
2. B2 tokens + gates (register, contrast, typography lint)
3. B4 Jotai migration (four stores; remove zustand)
4. B5 live sets (changefeed)
5. B3 routes
6. B6 layouts as data (CommonPlace + Theorem commonplace-api)
7. B8 declared blocks + B9 proving trio
8. B7 source installs + B10 dnd-kit movement

## Status lead

Not done at plan open: B1 through B10. Report updates live in `report.md`.
