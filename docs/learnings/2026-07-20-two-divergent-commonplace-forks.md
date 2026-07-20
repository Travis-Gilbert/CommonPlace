---
title: There are two commonplace crates and two commonplace-api forks; pick by deploy config, not by the topology doc
kind: gotcha
date: 2026-07-20
scope: CommonPlace + Theorem sibling repos (Rust)
---

## trigger_case (the real scar)

Placing a new engine crate for SPEC-COMMONPLACE-FILING-AND-INDEX-1.0. The spec
named `rustyredcore_THG/crates/rustyred-thg-filing`. `docs/architecture/api-topology.md`
opens with "There is **one store** and **one canonical GraphQL API**", which
reads like the decision is already made.

It is not. Both of these exist and have diverged:

| | CommonPlace repo | Theorem repo |
|---|---|---|
| object model | `crates/commonplace` | `rustyredcore_THG/crates/commonplace` |
| API | `apps/commonplace-api` (schema.rs 2,730 lines) | `apps/commonplace-api` (schema.rs 4,040 lines) |

`diff` on the two `collection.rs` files: the CommonPlace copy has five extra
`CollectionKind` variants (Project, Cycle, Module, Initiative, Teamspace) and
eight extra `Collection` fields the Theorem copy does not. They are not the same
type. Linking both into one binary gives you two incompatible `Collection`s.

I nearly built against the CommonPlace fork because it is the repo the session
was rooted in and it has the richer object model.

## rule_short

Decide which fork is live by **what deploys and what is gated**, not by prose:

```bash
# The live one has deploy config, a checked-in SDL, and a drift test.
ls Theorem/apps/commonplace-api/{railway.toml,Dockerfile,schema.graphql}
ls Theorem/apps/commonplace-api/tests/schema_sdl_drift.rs
# And confirm which object model it actually binds:
grep '^commonplace = ' <fork>/apps/commonplace-api/Cargo.toml
```

As of this session the live fork is **Theorem's**: it carries `railway.toml`, a
`Dockerfile`, a 424-line checked-in `schema.graphql` with an SDL drift gate, the
`find`/`scatter` doors, `proactivityGraph`, and `workspace`, and it binds
`commonplace = { path = "../../rustyredcore_THG/crates/commonplace" }`. The
CommonPlace-repo fork carries publish/attestation, annotations, and its own MCP
server, and binds its own local `crates/commonplace`.

## why

The topology doc's "one store, one API" describes the *intent* of the
architecture, not the current tree. The `refactor(release): split the engine and
app factories across repositories` commit is what created the second copy, and
the doc was not updated. Deploy config and a checked-in SDL cannot lie about
which artifact ships; a prose invariant can lag by months.

Practical consequence for a new substrate crate: keep it **id-typed**. The
filing crate moves `NodeId`/`CollectionId` (both bare `String` in this
substrate) and never passes a `Collection` struct across a door, so it is
immune to which fork a consumer links.

## also verify before writing against the spec's names

`rustyred-thg-core` publishes **none** of `NodeId`, `CollectionId`,
`EmbeddingRef`, `GoldenRecordRef`, or `Generation`. Ids are bare `String`;
an embedding is a `Vec<f32>` at node property `"embedding"`; the version
concept is `NodeRecord::version: u64`. `rustyred-thg-find/src/lib.rs:55`
declares its own `pub type NodeId = String;` for exactly this reason. Declare
local aliases so spec signatures read as written, and do not assume a spec's
type names exist.
