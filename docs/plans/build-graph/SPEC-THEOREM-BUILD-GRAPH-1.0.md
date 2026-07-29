# SPEC-THEOREM-BUILD-GRAPH-1.0

2026-07-28. `Travis-Gilbert/Theorem`, `Travis-Gilbert/CommonPlace`. Architecture decision plus execution handoff. Deliverables BG1 through BG7.

Answers two questions. Does full release require Theorem upstream of CommonPlace: yes at the artifact level, no at the source level, and the seam that makes the difference already exists in the tree. Is the compile-time situation sustainable: not as currently wired, and the fix is a three-ring program: don't build it, build it faster, build it elsewhere.

`CONVENTIONS.md` applies.

## Frame

The heaviness has one root. `pane-host-servo` takes `browser-embed` as a git-rev cargo dependency into `Travis-Gilbert/Theorem`, and `browser-embed` carries the customized Servo, which carries SpiderMonkey. So building CommonPlace's native shell from a clean checkout transitively builds a browser engine, which is the definition of unsustainable for a solo developer's inner loop.

But the architecture already refuses this, in writing. `pane-protocol` is a stdio wire contract; the Servo side is a **process**, and `browser-sidecar.pin`'s own design says the desktop app never compiles libservo, it consumes a signed binary pinned by tag and verified by sha256. A wire protocol across a process boundary is ABI-stable in the way Rust crate boundaries are not, which is exactly what makes prebuilt binaries safe here. The unsustainability is not the architecture; it is that one Cargo edge crosses the process boundary the architecture drew. Cut that edge and Theorem is upstream of CommonPlace the way Chromium is upstream of apps that embed it: as a versioned, hash-pinned artifact plus a small protocol crate, with a from-source escape hatch for the days the engine itself is being worked.

The customized Servo needs its own discipline, because a fork of a monthly-releasing engine either has a maintenance shape or it has drift. The shape: customizations live as an ordered patch series applied onto upstream tags, re-applied by CI the week each Servo release lands, with every patch carrying an upstreaming disposition. And the long game is to make the fork shrink: the SceneOS display-list producer is exactly the kind of embedder-facing hook Servo has been landing at partner request, positionable webviews, transparency, offscreen rendering all entered that way, so the seam should be proposed upstream as a generic embedder display-list producer. Every patch that merges upstream is fork weight that never has to be carried again. Customizations that cannot upstream live in `browser-embed` where possible, and inside the engine only where the engine must change.

The compile-time program, three rings, largest lever first. **Don't build it:** SpiderMonkey has a first-class prebuilt mechanism, `MOZJS_ARCHIVE` pointing at a `libmozjs.tar.gz`, documented in servo/mozjs and the Servo book precisely because that is where everyone's build time goes; the sidecar ships as the pinned binary; and one artifact-promotion pipeline feeds three consumers, sidecar pins, Railway deploys that `COPY` a released binary instead of compiling in the deploy path, and local prebuilts, which also retires the deploy-queue-churn failure class the store repair named. **Build it faster:** sccache with an S3-compatible backend pointed at the existing Coldstorage bucket, one cache shared by the Mac, CI, and RunPod builders; the nightly fast-lane dev profile, Cranelift codegen backend and the parallel frontend where they hold, both delivering real measured wins and both still nightly-gated with stabilization the compiler team's stated goal; mold on Linux builders; a workspace-hack crate to stop feature-unification rebuilds across the 105-crate workspace; and a `--timings` audit that names the long poles instead of guessing them. **Build it elsewhere:** a Linux big-iron builder, RunPod or a dedicated box, does the heavy clean builds and populates the shared cache; the Mac keeps the last-mile UI loop.

Explicitly considered and rejected for now: merging CommonPlace into the Theorem monorepo, which trades a cargo edge for permanent coupling; git submodules, which are the worst of both; and a Buck2 or Bazel migration, which is a real answer at a team's scale and a two-month detour at this one. The registry records the rejections so they stay decided.

## Named choices

1. **Artifact upstream, not source upstream.** CommonPlace's default build consumes `pane-protocol` as a versioned types crate and the Servo-side host as a prebuilt, signed, sha256-pinned binary. No Servo, mozjs, or browser-embed crate appears in CommonPlace's default `cargo tree`.
2. **The escape hatch is a feature, not a fork.** `servo-from-source` as a cargo feature plus a `[patch]` path override builds the sidecar from a local Theorem checkout for engine-hacking days, and CI keeps it compiling so the hatch never rusts shut.
3. **The wire contract is the only compile-time coupling.** `pane-protocol` is published or vendored with semver discipline and a two-sided conformance suite; a breaking wire change is a version bump both repos see, never a silent drift.
4. **The fork is a patch series with dispositions.** Upstream tag plus ordered patches, CI re-application per Servo release, and a `FORK.md` naming each patch, its reason, and its upstream status: filed, merged, blocked, or local-only with the reason.
5. **Upstream the seam.** The SceneOS display-list producer is proposed to Servo as a generic embedder hook; acceptance there is the strategic win, and until then the patch stays minimal and seam-shaped.
6. **One artifact pipeline, three consumers.** Tagged CI builds produce the signed binaries; sidecar pins, Railway images, and local prebuilts all consume the same artifacts by hash. Railway deploys stop compiling.
7. **The cache is shared and the profile is fast.** sccache to Coldstorage for every builder; the nightly fast-lane profile is opt-in per developer-day and never the release profile; release builds stay stable-toolchain, full-fat, reproducible.

## Deliverables

### BG1. Cut the edge

`Travis-Gilbert/CommonPlace` `pane-host-servo`, sidecar release pipeline

The prebuilt channel: the Theorem release pipeline builds the Servo-side host binary per tag, signed and notarized on macOS, published with sha256; CommonPlace's default features consume it through the pin discipline; `servo-from-source` plus the `[patch]` override restores today's behavior on demand.

Accepted when a clean CommonPlace checkout builds and runs the native shell with zero Servo, mozjs, or browser-embed crates in `cargo tree` (a CI gate greps for them), the pinned binary's hash is verified at fetch, and the from-source feature still builds against a local Theorem path.

### BG2. Publish the protocol

`pane-protocol`

Versioned and consumable without the Theorem workspace: minimal dependency surface verified, semver rules written into the crate docs, and the conformance suite runnable from either repo against either side.

Accepted when CommonPlace builds against the published version with the Theorem checkout absent, and a deliberately incompatible message shape fails the conformance suite on both sides.

### BG3. The fork becomes a patch series

Servo fork in `Travis-Gilbert/Theorem`

Restructured as upstream tag plus ordered patches; a CI job applies the series to each new Servo release, builds, and runs the seam tests, reporting apply-clean, apply-with-conflicts, or blocked; `FORK.md` lists every patch with its upstreaming disposition.

Accepted when the next Servo release's apply report exists within the week, every patch has a disposition, and at least the SceneOS producer patch has an upstream issue or PR filed with its link recorded.

### BG4. Prebuilt SpiderMonkey everywhere

Local dev, CI, release pipeline

`MOZJS_ARCHIVE` wired into every Servo-side build path, the archive cached in Coldstorage keyed by mozjs revision, rebuilt only when that revision changes, integrity by sha256.

Accepted when a clean Servo-side build with the archive present compiles zero SpiderMonkey sources (build-log gate), and the archive's hash is checked before use.

### BG5. The shared cache

All builders

sccache configured against the Coldstorage S3-compatible endpoint for the Mac, CI, and the Linux builder; hit-rate metrics surfaced; worktree and target-dir discipline documented so the several live worktrees stop paying full price.

Accepted when a clean Theorem workspace build on a second machine reports majority cache hits, and the hit rate is visible per builder.

### BG6. The fast lane

Workspace profiles and audit

The nightly dev profile: Cranelift codegen backend and parallel frontend flags where they hold on the actual toolchain and platforms, mold on Linux, per-package dev opt tuning, a hakari-style workspace-hack crate ending feature-unification rebuilds; a `--timings` audit committed with the top offenders named and their before-and-after measured.

Accepted when the audit document exists with measured deltas on the two worst crates, the fast-lane profile is one env or flag away for daily work, and release builds are untouched by any of it.

### BG7. Deploys stop compiling

Railway pipeline, composes with the store repair's promotion discipline

Tagged CI artifacts become the only thing Railway images contain: Dockerfiles `COPY` released binaries, deploys take seconds, and the promotion discipline from the residency repair applies to artifacts rather than rebuilds, ending the class where the deploy queue rebuilt and dropped repaired code.

Accepted when a service deploy from a tagged artifact completes without invoking cargo, the running binary's version matches the tag, and a rollback is a previous artifact promoted, not a rebuild.

## Verify First

- Whether the Servo customizations touch mozjs at all; if they do not, BG4's archive is pure upstream and trivially cacheable, and if they do, the archive is built from the fork and the patch series must say so.
- The exact current dependency shape: `pane-host-servo`'s Cargo entry for `browser-embed`, and what else in CommonPlace, if anything, reaches into the Theorem workspace.
- `pane-protocol`'s real dependency surface before BG2 claims it is minimal.
- sccache's S3-compatible configuration against the Coldstorage endpoint and credentials as they exist in `.railway/railway.ts`.
- Cranelift and parallel-frontend behavior on the actual nightly and on macOS arm64 specifically, measured, not assumed, before BG6 recommends them as the daily default.
- The current Railway build configuration per service, so BG7's artifact switch is an edit to reality.
- Whether the harness plan substrate the Cursor session wrote through differs from this surface's failing path, since the same store served one and refused the other today; that finding belongs to the serving-tier work.

## Anti-scope

- No monorepo merge, no submodules, no Buck2 or Bazel migration now; rejections recorded.
- No unpinned or unhashed prebuilt anywhere, and no prebuilt consumption in release builds without the same signature discipline as the sidecar.
- No nightly toolchain in release profiles.
- No fork patches outside the series, and no patch without a `FORK.md` disposition.
- No per-deploy compilation on Railway once BG7 lands.
