# D32–D36 seam inventory (WorkOS excluded)

**Date:** 2026-08-08  
**Plan task:** `wave-c-seams`  
**Goal:** `goal:aa1c8c6380701610`

| ARD | Present? | Notes | Disposition |
|---|---|---|---|
| D32 rerun | **partial** | `PrototypeStageView` + `@rerun-io/web-viewer`; program handoff | Keep prototype path; fleet-default / Dagster deep-link **blocked** on D35 |
| D33 marimo/pgwire | **absent UI** | `rustyred-thg-pg-server` exists in Theorem; no console marimo host | **blocker:** no marimo thin client until pgwire auth/session productized |
| D34 blender | **absent** | no theorem-blender repo/addon in workspace | **blocker:** greenfield GPL peer |
| D35 Dagster | **absent** | no Dagster in either repo | **blocker:** service not present |
| D36 DatasetVersion / Perspective | **absent UI** | DatasetVersion concepts in ARD; no Perspective/Lemma pin surface | **blocker:** needs Flight/DatasetVersion product door |
| WorkOS | **out of scope** | principal handles separately | closed for this plan |

**Rule:** no fake Dagster/Blender/marimo hosts claimed as done.
