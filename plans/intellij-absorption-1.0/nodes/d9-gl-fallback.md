# d9-gl-fallback — GL fallback policy (decision, charted from g0-verify)

- kind: decision
- controller: agent
- gist: The GL/WebGL2 web backend engages on the merged build but cannot create a wgpu device because floem requests default limits (compute workgroups 65535) and WebGL2 grants 0. Decide the fallback policy: patch floem vs require WebGPU.
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

## Options (for the deciding session)

1. **Require WebGPU (status quo).** Record the GL-fallback acceptance item as failed-at-pin with this evidence; the browser IDE targets WebGPU-capable Chromium (the realistic host). Zero work; the acceptance item converts to "WebGPU required", documented.
2. **Patch floem (fork or patch crate).** Request `Limits::downlevel_webgl2_defaults()` (or `adapter.limits()`) when the adapter reports no compute; audit whether any floem-renderer pipeline genuinely needs compute (glyph/text work) — if yes, a compute-free path is required for GL-on-web; harden the `unwrap()` at `app_handle.rs:83` to surface a renderer error instead of panicking (also fixes the winit cascade).
3. **Upstream proposal.** Carry option 2 as a floem PR; adopt a temporary patch crate until merged.

## Secondary findings to carry (recorded in G0-VERIFY.md O-G.4)

- floem unwraps adapter/device errors on web → panics; any fallback work should harden this seam.
- Pixel-distinctness alone is a false-positive render oracle (page chrome colors); render verdicts need a canvas-region probe + no-panics gate.

## Discharge

PENDING — decision not yet taken. Investigation advanced to the floem source (2026-08-10):

- `gpu_resources.rs:89-118` — first device request uses `Limits::default()` (compute 65535); on error, retry uses `Limits::downlevel_defaults()`. `required_features` comes from the app config (`app_handle.rs:473` `self.config.wgpu_features`).
- wgpu-types 24.0.0 (the resolved version in the merged lockfile): `downlevel_defaults()` sets `max_compute_workgroups_per_dimension: 0` — so the retry's limits should pass on WebGL2, yet the observed failure still reports `requested: 65535`. **Investigation stopped here** (why the retry reports the first request's limit is an open wgpu-core question — start at `wgpu-core-24.0.5` web/GL backend `request_device`; candidates: limits re-validated against defaults, or the error is re-reported from the first attempt).
- Decision options and the floem-patch shape are recorded in the Options section above; the patch work (if chosen) is a floem fork/patch-crate task, not this decision node.

STATE: parked (2026-08-10) — decision + the retry-mystery investigation handed to the next agent; evidence complete in G0-VERIFY.md O-G.4. The decision does NOT gate any other node (WebGPU path healthy).

## Scope

Decision record only. No floem/dependency changes in this node's name until the decision is recorded.
