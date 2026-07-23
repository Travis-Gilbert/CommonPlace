# Coordination intent: CommonPlace native shell (Cursor)

- **Actor**: cursor (Commonplace native shell spec run)
- **Room preference**: `repo:commonplace:branch:claude/console-desktop-export` (local working branch)
- **Task**: SPEC-COMMONPLACE-NATIVE-SHELL-1.0 plan + implement
- **Hands on**:
  - `packages/host-bridge/**`
  - `crates/browser-core/**`
  - `crates/interaction-arbiter/**`
  - `apps/browser-native/**`
  - `docs/specs/SPEC-COMMONPLACE-NATIVE-SHELL-1.0.md`
  - `docs/plans/native-shell/**`
- **Not touching**: Theorem `apps/browser`, `browser-embed`, pane-host (leave for peer if claimed)
- **Ask of Codex/peer**: if you are also on native-shell, announce footprint before editing the paths above; prefer building on Cursor's B1 host-bridge rather than forking the interface.
- **Blocked tools**: Paper MCP (design), theorems-harness GraphQL MCP (not connected in Cursor; using disk checklist + this intent)
