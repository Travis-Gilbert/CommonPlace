# Native console visual review

Date: 2026-07-22
Runtime: macOS app bundle built from `apps/console-native`
Visual channel: Codex Computer Use

## Observed gates

- The 1184 by 768 app frame rendered the gpui-component title bar, center tab
  dock, receipts dock, bottom watch dock, overview metric groups, bar chart,
  readiness tags, and status footer.
- Clicking `Emit scripted firing` changed the visible watch ring from three to
  four retained events and added sequence 4 at the top.
- Opening Graph neighborhood rendered four connected nodes. Before selection,
  all nodes used the neutral color. Clicking the Ada node highlighted only that
  node and rendered `Ada Lovelace` with `golden:person:ada` in the selected
  entity group.
- Collapsing Receipts persisted `right_dock.open = false`. After terminating
  that process and launching a second bundle identity, Receipts remained
  collapsed and Standing watch remained open.

## Findings

- Fixed in the application: an identity-less node compared equal to an empty
  selection and appeared selected.
- Fixed in the application: relying only on `DockEvent::LayoutChanged` missed
  center-tab and fixed-dock mutations. A serialized write-on-change snapshot
  now persists live layout state.
- Upstream at the pinned gpui-component v0.5.1 commit: the serialized center
  `active_index` is not applied to the live `TabPanel` during restore. Dock
  structure restores, but the center tab returns to Overview.

## Capture status

The interactive frames were inspected before the Mac locked. Exporting the
final image files was attempted after the implementation fixes, but the visual
service refused capture while the host was locked. CC7 must save the final
frames after unlock. No privacy-black screenshot is retained as evidence.
