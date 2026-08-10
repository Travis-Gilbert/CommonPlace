# d9-gl-fallback — GL fallback policy (decision, charted from g0-verify)

- kind: decision
- controller: agent
- gist: The GL/WebGL2 backend engages, but Floem's retry is GLES-3.1 rather than WebGL2-safe; a safe-limits live probe then reaches two structural renderer barriers. Policy decided: the browser IDE requires WebGPU at this pin.
- provenance: g0-verify O-G.4 (EXECUTED 2026-08-10); parent evidence `Theorem/docs/plans/intellij-absorption/G0-VERIFY.md` O-G.4; charted as a decision row, not wave-5 scope (floem is an upstream git dep at Lapce's pin 31fa8f444c37f4c314f47d88c23ffdbc25f2ab53).

## The finding (evidence, not opinion)

On the merged `theorem-ide-app` wasm bundle, headed Chrome for Testing 1234:

- Control (WebGPU available, Metal-3 adapter): workbench renders, zero panics — **the healthy WebGPU path**.
- `--disable-features=WebGPU` and `--disable-webgpu` are both no-ops in CfT 1234 (`navigator.gpu` present, adapter Metal-3).
- `--disable-gpu` + no unsafe-swiftshader over-forces: WebGPU null AND WebGL2 context dead → wgpu "No available adapters." → floem `unwrap()` panic `AdapterNotFoundError` at `app_handle.rs:83:71`.
- Page-level `navigator.gpu` shadow (the committed forcing method in `gl-fallback.js`): **the GL/WebGL2 backend engages** (adapter enumerates; wgpu `webgl` feature unified — `cargo tree -e features` confirms), but `request_device` fails:
  `LimitsExceeded(FailedLimit { name: "max_compute_workgroups_per_dimension", requested: 65535, allowed: 0 })`
  → floem `unwrap()` panic; canvas unpainted; winit-web "RefCell already borrowed" cascade panic.

Root cause: floem-renderer's device request uses default limits (compute 65535); the wgpu GL backend reports compute limits 0 (WebGL2 has no compute shaders). The renderer cannot create a device on GL at this floem pin.

## Decision (2026-08-10)

**Require WebGPU for the browser IDE at floem pin `31fa8f44`.** Do not claim a GL/WebGL2 fallback. The healthy WebGPU/Metal control remains the supported browser path.

The one-line limits patch is necessary but not sufficient. A true no-WebGPU fallback would require a separate renderer project: choose the renderer before wgpu claims the canvas, then either route to TinySkia/Canvas2D without creating a WebGL surface or supply a WebGL-compatible renderer that does not require vertex storage buffers. That work is not a safe dependency patch and is not required by any dependent node on this board.

## Options (for the deciding session)

1. **Require WebGPU (status quo).** Record the GL-fallback acceptance item as failed-at-pin with this evidence; the browser IDE targets WebGPU-capable Chromium (the realistic host). Zero work; the acceptance item converts to "WebGPU required", documented.
2. **Patch floem (fork or patch crate).** Request `Limits::downlevel_webgl2_defaults()` (or `adapter.limits()`) when the adapter reports no compute; audit whether any floem-renderer pipeline genuinely needs compute (glyph/text work) — if yes, a compute-free path is required for GL-on-web; harden the `unwrap()` at `app_handle.rs:83` to surface a renderer error instead of panicking (also fixes the winit cascade).
3. **Upstream proposal.** Carry option 2 as a floem PR; adopt a temporary patch crate until merged.

## Secondary findings to carry (recorded in G0-VERIFY.md O-G.4)

- floem unwraps adapter/device errors on web → panics; any fallback work should harden this seam.
- Pixel-distinctness alone is a false-positive render oracle (page chrome colors); render verdicts need a canvas-region probe + no-panics gate.

## Discharge

GATE PASSED (2026-08-10). All decision obligations have replayable evidence:

- [x] **O-D9.1: explain `requested: 65535`.** Pinned wgpu-types `24.0.0` source, `src/lib.rs:1297-1419`, proves `Limits::downlevel_defaults()` is the GLES-3.1/D3D11 profile and retains `max_compute_workgroups_per_dimension: 65535`; only `downlevel_webgl2_defaults()` sets the compute family to zero. The parked record's claim that `downlevel_defaults()` used zero was false. No wgpu-core re-reporting mystery exists.
- [x] **O-D9.2: test the bounded limits repair on the real app.** A temporary copy of floem `31fa8f44` changed only the retry at `renderer/src/gpu_resources.rs:114` to `Limits::downlevel_webgl2_defaults()`. The release wasm build completed (`Finished release profile [optimized]`), and the committed page-level `navigator.gpu`-shadow oracle was replayed in headed Chrome for Testing 1234.
- [x] **O-D9.3: identify the next layer.** The patched trace contains no `LimitsExceeded`/`65535`; device creation therefore passed. Vger then refused `adapter doesn't support required downlevel flags` because it requires `DownlevelFlags::VERTEX_STORAGE` (`vger/src/lib.rs:59-69`) and its pinned shaders use storage buffers. Floem's TinySkia fallback then failed because wgpu had already created a WebGL context on the same canvas: `A canvas context other than CanvasRenderingContext2d was already created`.
- [x] **O-D9.4: take the policy decision.** WebGPU is required at this pin. A future no-WebGPU fallback must be charted as renderer architecture, not described as a limits patch.
- [x] **O-D9.5: preserve proof.** Patched-run console and screenshot: `evidence/d9-gl-fallback/console-webgl2-safe-limits.log` and `evidence/d9-gl-fallback/render-webgl2-safe-limits.png`. Original failing trace remains in the fork and G0 record.

Proof command and output:

```text
! rg -q 'LimitsExceeded|requested: 65535' /tmp/d9-gl-probe/console.log \
  && rg -q "adapter doesn't support required downlevel flags" /tmp/d9-gl-probe/console.log \
  && rg -q 'CanvasRenderingContext2d.*already created' /tmp/d9-gl-probe/console.log \
  && echo 'PASS: WebGL2-safe limits cleared device creation and exposed the Vger and canvas-context barriers'

PASS: WebGL2-safe limits cleared device creation and exposed the Vger and canvas-context barriers
```

STATE: done (2026-08-10) — decision sealed; no dependent node was blocked, and the supported WebGPU path remains healthy.

## Released claim

- occupant: `/root` (Codex)
- occupied_at: `2026-08-10T18:50:14-04:00`
- released_at: `2026-08-10T19:07:20-04:00`
- scope: this decision record plus `manifest.md`, `replay.md`, `edges.md`, `lessons.md`, `CONTINUITY.md`, and `evidence/d9-gl-fallback/*`; read-only inspection of the pinned floem/wgpu sources and existing G0 runtime evidence
- program: resolve why the floem retry still surfaces `requested: 65535`, then take and discharge the GL fallback policy decision without modifying floem or dependency pins in this node

## Scope

Decision record only. No floem/dependency changes in this node's name until the decision is recorded.
