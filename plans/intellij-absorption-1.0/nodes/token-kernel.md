# token-kernel — typed token kernel + generated Lapce theme (work)

- kind: work
- controller: agent
- gist: Typed `Space`/`Inset`/`Surface` kernel with only scale values representable; Int UI theme crate binding as the K1 consumer; generated Lapce color-theme file so the fork wears the design system on day one through Lapce's existing theme mechanism.
- provenance: HANDOFF-LAPCE-FORK-SPIKE-1.0 post-gate item 4 + styling-API amendment (three layers: tokens / kernel / consumers; the kernel is framework-free; same decisions everywhere, not pixel-identical rendering).

## Blueprint

Three layers, built top-down:

### Layer 0 — token source (K1 seed)
`platform/jewel/int-ui/int-ui-standalone` (the closure manifest's K1 home) does NOT exist in any repo. The token-kernel must establish the canonical token source:
1. Search for existing Int UI/design tokens in the CommonPlace console (`apps/console/src/components/ground/MaterialLayer.tsx` is the design-system sentinel; also look for token/CSS-variable files under `apps/console/src`).
2. If a token source exists, canonicalize it (JSON + typed constants).
3. If none exists, extract the console's current palette/metrics from MaterialLayer as the K1 seed — record provenance honestly in the evidence file ("seed authored from CommonPlace console MaterialLayer; int-ui-standalone home absent; K1 codegen prerequisite row charted").

### Layer 1 — the kernel crate `theorem-style` (framework-free)
New crate, own workspace area in the Theorem repo per the graduation rule (UI library depends on nothing of ours; graduates into Theorem first, public MIT at gate two). Suggested home: `Theorem/apps/theorem-style/` with the kernel crate (`theorem-style`) + a generator bin (`theorem-style-gen`).
- `Space`: only the eight scale values representable (e.g. `Space::S0..S7` or a `u8` enum with a checked constructor).
- `Inset(Space)`, `Gap(Space)`.
- `Surface` handed down by containers (typed surface roles, not raw colors).
- Text styles by role; density as a mode parameter.
- No margin constructor on block-level surfaces.
- No raw pixel/color values outside the token layer.

### Layer 2 — consumers
- Int UI theme crate binding (typed theme built from the token source) as the K1 consumer.
- Generated Lapce color-theme file from the same tokens: emit into `Theorem/apps/theorem-ide/lapce/themes/` following Lapce's theme TOML schema (check the fork's `themes/` dir for the schema of existing theme files — Lapce themes are TOML with `[theme]` sections). The fork wears Int UI through Lapce's existing theme mechanism with zero style-API work.
- (Floem Style-chain binding is layer-3 work for the ws-integration wave — do NOT build floem this wave; note it as remains.)

## Obligations

- O-TK.1: Token source established (found + canonicalized, or seeded from MaterialLayer with provenance). Proof: evidence paragraph + token JSON/constants committed.
- O-TK.2: `theorem-style` kernel crate compiles: typed Space/Inset/Gap/Surface, text roles, density mode, no margin constructor on block-level surfaces, no raw values. Proof: `cargo +1.96.1 check` green (CARGO_TARGET_DIR override).
- O-TK.3: Int UI theme crate binding exists (typed theme from tokens). Proof: check green.
- O-TK.4: Generated Lapce theme file emitted and valid (parses against the fork's theme schema; ideally loadable by the fork — a schema-shape test or manual comparison with an existing theme file). Proof: the file + a validation note.

## Scope

Writes: new dirs under `Theorem/apps/theorem-style/`, `Theorem/apps/theorem-ide/lapce/themes/` (new file only), evidence at `Theorem/docs/plans/intellij-absorption/TOKEN-KERNEL.md`. Reads: CommonPlace console (MaterialLayer etc.) for the token seed. Do NOT touch: any crate under rustyredcore_THG, the fork's source, the board.

## Environment (mandatory)

- `CARGO_TARGET_DIR=/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/apps/theorem-style/.target` (or the shared theorem-ide target dir) — NEVER the SSD target (100% full). `cargo check` only, `-j 4`.
- `cargo +1.96.1`. No floem dependency this wave. No git commits (leave tree for the head).

## Acceptance

Kernel checks green; theme crate checks green; valid generated Lapce theme file in the fork's themes dir; token provenance recorded.

## Discharge (2026-08-10)

- O-TK.1 DISCHARGED: K1 home (`platform/jewel/int-ui/int-ui-standalone`) confirmed absent. REAL Int UI tokens found live in the CommonPlace console — `apps/console/src/styles/int-ui-register.css` (dark), `int-ui-register-light.css`, `geometry.css` — the dark register declares verbatim Int UI (JetBrains `expUI_dark.theme.json`, SHA 1a82cda); MaterialLayer.tsx confirmed `--ij-*` vars as the contract. Canonicalized into `Theorem/apps/theorem-style/tokens/int-ui.json` (both schemes, ramps, 5 elevation tiers, surfaces, ink, accent, overlays, status, domain accents, progress, rows, shared scale block: 8 space steps, radii, metrics, type faces, motion; `color-mix` resolved to 8-digit hex). Provenance note embedded + K1 codegen prerequisite charted as a remains row.
- O-TK.2 DISCHARGED: `theorem-style` kernel crate (zero deps): `Space` = exactly eight values (Px4|Px6|Px8|Px12|Px16|Px24|Px28|Px40), checked constructor; `Inset(Space)`/`Gap(Space)`; `Surface`/`SurfaceRole` (11 roles) handed down by containers with ambient `Density`; `BlockSurface` — no margin constructor (API-enforced); text styles by role; `Density` as mode parameter (Compact 24 / Comfortable 28); opaque `Color`; no raw values outside token layer. Proof: `cargo +1.96.1 check -j 4` → Finished, 0 warnings.
- O-TK.3 DISCHARGED: `theorem-style-intui` theme crate binding (serde model of int-ui.json via include_str!, builds kernel `Theme` for dark/light at any density). Check green.
- O-TK.4 DISCHARGED: generated `theorem-int-ui.toml` (5,956 B, "Theorem Int UI Dark", #:schema header) into `Theorem/apps/theorem-ide/lapce/themes/`; schema MATCH against stock `defaults/dark-theme.toml` + `light-theme.toml` — 165 keys across 4 tables (token decisions: hues, status, heights 40/28/13 + stock dialect defaults where Lapce owns chrome).
- Remains (recorded): floem Style-chain binding (next wave, no floem dep by mandate), CSS + Rust-constants dialects (`--dialect css|rust`), light Lapce theme (binary ready), K1 codegen row (int-ui.json is the interim canonical source + reconciliation target), fork activation (fork scans user data-dir themes, not repo themes — styling-wave wiring), Plex/Mono face decision (`font-family = ""` until floem owns font loading).

STATE: done. Verify sibling: v-token-kernel (gate PASSED 2026-08-10). Evidence: `Theorem/docs/plans/intellij-absorption/TOKEN-KERNEL.md`.
