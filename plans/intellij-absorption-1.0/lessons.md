# lessons

- `capability` — winit-web `EventLoop::run_app` on wasm throws "Using exceptions for control flow, don't mind me. This isn't actually an error!" as *intended control flow* to unwind the wasm stack after scheduling the async loop; catching it and treating it as boot failure is wrong — success is canvas paint + a live event loop. (Confirmed in winit @ ee245c5 `event_loop/mod.rs` run_app: `elw.run(handler, false)` then `backend::throw`.)
- `capability` — `Backends::all()` in floem-renderer/wgpu on wasm = WebGPU only unless the `webgl` feature is enabled on wgpu; a direct wasm-target dep `wgpu = { version = "24.0.5", features = ["webgl"] }` unifies into floem-renderer's wgpu pin and enables the GLES fallback.
- `capability` — wasm32-unknown-unknown has no libc: tree-sitter C needs wasi-libc + `--allow-undefined`, and the resulting wasm imports `wasi_snapshot_preview1` (7 imports) which `@bjorn3/browser_wasi_shim` + a glue patch can satisfy in-page.
- `artifact` — Lapce dark-theme geometry: `$black = #282C34` = editor.background (primary), `secondary-background = #21252B` = panels/palette/status bar; explorer is LEFT, editor RIGHT in the 800x600 default canvas.
- `artifact` — headless Chrome (any SwiftShader combo tried) exposes no `navigator.gpu`; headed Chrome on macOS does (Metal). S0.3 browser boot therefore requires a headed browser.
- `artifact` — cargo target-dir for this machine is the external SSD (`/Volumes/SSD Samsung/cargo-target` via ~/.cargo/config.toml); it filled twice and OOM'd the machine. Clean stale incremental dirs after big wasm builds.
- `artifact` — canvas does not follow window resize on this floem/winit pin (inline 800px style never updated); recorded as observation for the report, not a gate.
