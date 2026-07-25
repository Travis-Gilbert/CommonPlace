# Vendor reference: recursive-dnd-kanban-board

Source: https://github.com/mehrdadrafiee/recursive-dnd-kanban-board (MIT).

This tree is a **reference only**. Runtime drag uses `@dnd-kit/core` and
`@dnd-kit/sortable` in the console app. Do not import these files from
`apps/console/src`. Keep them for nesting patterns (`NestedColumn`, multi-
container sensors, `SortableContext` over nested columns) when wiring B10
promotion and the kanban block.

Kept files: `components/board/*` (KanbanBoard, BoardColumn, CarCard,
keyboard preset). App shell, UI primitives, and lockfiles were stripped.
