# DECISION-ISOLATION: workspace tenancy (WT9)

**Date:** 2026-08-06  
**Spec:** SPEC-COMMONPLACE-WORKSPACE-TENANCY-1.0  
**Status:** accepted for near-term

## Decision

**Near-term:** one Railway `commonplace-workspace` instance (and its sticky
volume) serves **many workspace objects**. Isolation is by contract:

- path `/workspace/{workspace_id}`
- per-workspace `--user-data-dir` / extensions dir (when a session is bound)
- installation token minted per git request (never in env for user code)
- tenant segment on every graph key (WT6)

Not by one container per workspace.

## Evidence

- Today: one Studio/`setsid` IDE process, one OpenWork process, one volume
  (`packaging/workspace/entrypoint.sh`).
- Folder selection is launch-time `--default-folder` in packaging; `?folder=`
  unproven for Studio reh-web (`VERIFY-FIRST.md` §1).
- Railway volume is already the durable mount; spinning N Studio processes per
  active user is a later cost, not required for the object contract.

## What the contract must hold regardless of posture

1. No `WORKSPACE_REPO` / `WORKSPACE_REPO_URL` / boot clone.
2. Workspace id in every checkout path.
3. Token per git request via credential helper → API (WT3).
4. Folder binding per session (mechanism may evolve: process restart,
   `?folder=` if proven, or per-session server).

## Revisit trigger

Revisit when any of:

- concurrent sessions on different workspaces collide on a single Studio
  process (proven live), or
- volume IOPS / disk for N checkouts exceeds a measured Railway ceiling, or
- compliance requires process-level isolation between tenants.

Then swap deployment (N replicas or per-workspace workers) without redesigning
the workspace object, paths, or token lanes.

## Non-dependency

WT1–WT8 acceptance does not depend on this posture choice; only WT4’s open
mechanism references the Verify-first folder finding.
