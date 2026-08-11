# token-kernel-binding — consumers for the theorem-style kernel (work, wave 6)

- kind: work
- controller: agent
- gist: Layer-2/3 consumers for the theorem-style kernel: generator dialects (CSS custom properties, Rust constants), the light Lapce theme emission, kernel/binding unit tests, and (charted) the floem Style-chain binding + fork activation.
- provenance: token-kernel remains (TOKEN-KERNEL.md section 8); styling-API amendment (layers: tokens / kernel / consumers; "the fork wears Int UI on day one through a config file").
- claim: 2026-08-10 (session 6) — parallel to the mcp/IDE thread; chosen for disjoint write scope (theorem-style workspace + fork themes dir only) and zero shared-target build contention.

## Blueprint

From token-kernel remains:
1. **CSS dialect** (`--dialect css`) — emit the `--ij-*` contract vars (console register names; MaterialLayer contract) as literals, both schemes (`:root` dark + `[data-scheme="light"]`).
2. **Rust-constants dialect** (`--dialect rust`) — emit the dark-scheme constants module mirroring `crates/theorem-style/src/tokens.rs`; **drift guard**: a test asserting generated output is value-identical to the kernel constants (alias-resolved).
3. **Light Lapce theme** — the gen binary already supports `--scheme light`; emit + schema-check against `defaults/light-theme.toml`.
4. **Kernel/binding unit tests** — the kernel was only ever `check`ed; make `cargo test` green for the whole workspace.
5. **floem Style-chain binding** — CHARTED (heavy compile; deliberately NOT this session: the shared cargo target + disk are contended by the mcp/IDE thread's builds — a floem codegen build now could ENOSPC or race the other head).

## Obligations

- O-TKB.1: CSS dialect emits the `--ij-*` contract (register-derived names, literals, both schemes). Proof: gen test + generated `dialects/int-ui.css`.
- O-TKB.2: Rust-constants dialect + drift guard. Proof: `rust_dialect_matches_kernel_tokens` green + generated `dialects/int-ui-constants.rs`.
- O-TKB.3: Light Lapce theme emitted + schema MATCH against stock. Proof: gen run output.
- O-TKB.4: Workspace `cargo test` green (kernel + binding + gen). Proof: test output.
- O-TKB.5 (charted, parked): floem Style-chain binding + fork activation (user-data-dir theme wiring). Parked with reason: shared-build contention + disk; resume in a disk-quiet session.

## Scope

Writes: `Theorem/apps/theorem-style/` (gen dialects, intui tests, kernel test fix), `Theorem/apps/theorem-ide/lapce/themes/theorem-int-ui-light.toml` (new file), `Theorem/docs/plans/intellij-absorption/TOKEN-KERNEL.md`. Do NOT touch: rustyredcore_THG, the fork's source, apps/console (other-agent churn), the board's other nodes.

## Environment

`CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-style/.target` (own target — avoids shared-target races with the IDE thread); `CARGO_HOME` = theorem-ide `.cargo-home`; `cargo +1.96.1`, `-j 4`.

## Discharge (2026-08-10, session 6)

- O-TKB.1 DISCHARGED: `dialects/css.rs` (300 lines) — `COLOR_VARS` name table derived from the console register by value-join (2026-08-10); ramps mechanical (`--ij-{family}-{step}`); scale vars (`--ij-control-h`, `--ij-arc`, `--ij-font-ui`, …); 8-digit alpha preserved (`--ij-tier-scrim: #00000085`); one stylesheet, `:root` dark + `[data-scheme="light"]` overrides. Generated `dialects/int-ui.css` (7,194 B). Tests: `dark_root_and_light_override` + `register_contract_names_covered` (40-name contract list).
- O-TKB.2 DISCHARGED: `dialects/rust.rs` — mechanical naming rules (ramps `{FAMILY}_{STEP}`, tiers `TIER_*`, ink `INK*`, accent `ACCENT`/`ACCENT_HOVER`, bare elsewhere; 8-digit → `Color::rgba`). Generated `dialects/int-ui-constants.rs` (6,740 B). Drift guard `rust_dialect_matches_kernel_tokens`: parses the kernel `tokens.rs` (alias chains resolved: FRAME=TIER_FRAME, INK=GRAY_12, …) and asserts name-for-name, value-for-value equality with the generated output — GREEN.
- O-TKB.3 DISCHARGED: `theorem-int-ui-light.toml` (5,965 B) into `apps/theorem-ide/lapce/themes/`; schema check vs `defaults/light-theme.toml`: **MATCH (165 keys across 4 tables)** — same verdict as the dark theme.
- O-TKB.4 DISCHARGED: full workspace `cargo test` green — kernel 12/12 (incl. one pre-existing test compile bug fixed: `space.rs:142` `.map(Space::try_from)` resolved the `TryFrom<i32>` impl instead of `try_from_px` — kernel was only ever `check`ed), gen 4/4 (css×2, rust drift+shape), intui 8/8 (5 new binding tests: register contract values, light≠dark, density mode, text role mapping, token-derived metrics), doc-tests 1.
- O-TKB.5 PARKED (charted): floem Style-chain binding + fork activation. Reason: the floem binding requires a multi-GiB codegen build; the shared target + disk are contended by the mcp/IDE thread (Codex) — running it now risks ENOSPC/races. Resume: disk-quiet session, own target dir, floem pin 31fa8f44.

- O-TKB.5 DISCHARGED (2026-08-11): floem Style-chain binding + fork activation. See Discharge O-TKB.5 below.

## Discharge O-TKB.5 (2026-08-11, session 10 — floem binding wave)

- **Kernel extension**: `TextColorRole::ALL`/`index()` (closed 9-role set) + `TextColorMap` + `Theme::resolve_text_color` — text ink now resolves at the theme boundary (was deferred: "ink values resolve at the theme boundary, not here" is now true). `theorem-style-intui` fills the map from `ink.*`, `accent.link/accent`, `status.error/warn/ok`.
- **`theorem-style-floem` binding crate**: `ThemeStyle::new(&theme)` → `surface(role)` / `keyline(role)` (1px uniform border) / `text(role)` (family, size, weight, ink — all theme-resolved) / `row()` (density) / `inset` / `gap` / `block(BlockSurface)` (inset, never margin — the composition law) / `radius(Space)` (radius scale only) / `control` / `tab` / `toolbar` / `statusbar` (register heights). Same floem pin 31fa8f44 + feature set as theorem-ide-app. floem Style API used as-is, never forked.
- **Drift guards**: 8 tests read each produced `Style` back through floem's public prop API (`get(Background)`, `get(FontSize)`, `get(PaddingLeft)`, …) and assert equality with the theme boundary's resolution — both schemes, all 11 surface roles, 5 keylines, 12 text roles, 2 densities, radius scale, block law, metrics heights, conversion vocabulary.
- **Fork activation**: app loads themes from `Directory::themes_directory()` = `~/Library/Application Support/dev.lapce.Lapce-{Debug,Stable}/themes/` (NOT the repo themes dir — confirmed in theorem-ide-core/src/directory.rs + config.rs `load_local_themes`). Both generated themes placed in both data-dirs (checksums 365b254a dark / f7d0b046 light). Selectable via palette or `color-theme = "Theorem Int UI Dark"`.
- **Proof**: `cargo +1.96.1 test -j 4` (CARGO_HOME=theorem-ide/.cargo-home, CARGO_TARGET_DIR=/Volumes/SSD Samsung/theorem-builds/k5-target) — kernel 12/12, floem 8/8, gen 4/4, intui 9/9, doc 1 — 34 total, 0 warnings; log `/tmp/tkb5-test.log`. Evidence: TOKEN-KERNEL.md §9.

STATE: done (dialects css+rust with drift guard, light theme schema MATCH 165 keys, floem Style-chain binding + drift guards, user-data-dir activation; workspace tests 34/34 green). Verify: sibling verify node charted at v-ws-integration's wave-6 successor (next wave gate).
