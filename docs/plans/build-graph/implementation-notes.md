# SPEC-THEOREM-BUILD-GRAPH-1.0 — implementation notes

Plan: `plan:ab29abe3999b960c`.

## Landed this pass

| Deliverable | Where | Status |
|---|---|---|
| BG1 cut edge (pin + fetch + from-source hatch) | `apps/browser-native/browser-sidecar.pin`, `scripts/fetch-pane-host.sh`, `crates/pane-host-servo` feature docs | Pin/fetch ready; sha256 empty until release |
| BG2 pane-protocol 0.2 | `crates/pane-protocol` | Semver docs + SetFocus/InjectKey/InjectIme/SetOverlay + conformance test |
| SR-008 bounds x/y | Theorem `browser-embed` `position.rs` | Child NSView on macOS; Deferred elsewhere |
| SR-008 focus/IME | Theorem `input.rs` + protocol + `pane-host-servo` | Script synthesis seam |
| SR-008 SceneOS overlay | Theorem `overlay.rs` + `FORK.md` | Typed atoms + injection producer |
| BG3 dispositions | Theorem `apps/browser/FORK.md` | Three seams registered |
| BG4–BG7 | This note | Scaffold / gates only |

## Acceptance gates still open

1. **BG1 hash verify** — `browser-sidecar.pin` sha256 fields empty; fetch refuses until Theorem publishes `browser-v*` assets and `--update` rewrites the pin.
2. **BG4 MOZJS_ARCHIVE** — needs Coldstorage credentials and Servo-side wiring in Theorem CI.
3. **BG5 sccache** — Coldstorage S3 endpoint from `.railway/railway.ts`.
4. **BG6 fast lane** — measure Cranelift / parallel-frontend on the actual nightly before recommending as daily default.
5. **BG7 Railway COPY** — per-service Dockerfile edits once tagged artifacts exist.

## From-source hatch

```bash
# Local Theorem path override (engine-hacking day)
mkdir -p .cargo
cat > .cargo/config.toml <<'EOF'
[patch."https://github.com/Travis-Gilbert/Theorem.git"]
browser-embed = { path = "../Theorem/apps/browser/crates/browser-embed" }
EOF
cargo build --manifest-path crates/pane-host-servo/Cargo.toml --features servo-from-source
```

Bump `browser-embed` git `rev` in `crates/pane-host-servo/Cargo.toml` after the Theorem seam branch merges.
