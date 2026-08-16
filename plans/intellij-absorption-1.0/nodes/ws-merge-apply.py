#!/usr/bin/env python3
"""ws-merge: apply substrate workspace Cargo.toml changes (members, workspace.package,
workspace.dependencies from the fork, patches, profiles). Idempotent-ish: asserts anchors."""
import sys

P = "/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem/rustyredcore_THG/Cargo.toml"
s = open(P).read()

# 1. members
anchor = '    "crates/theorem-tensor-block",\n]'
assert anchor in s, "members anchor missing"
s = s.replace(anchor, '    "crates/theorem-tensor-block",\n    "crates/theorem-ide-rpc",\n    "crates/theorem-ide-proxy",\n    "crates/theorem-ide-app",\n    "crates/theorem-ide-core",\n]')

# 2. workspace.package after the exclude line, before [workspace.dependencies]
anchor2 = 'exclude = ["crates/rustyred-thg-graphblas"]\n\n[workspace.dependencies]'
assert anchor2 in s, "exclude/workspace.dependencies anchor missing"
s = s.replace(anchor2, 'exclude = ["crates/rustyred-thg-graphblas"]\n\n# Absorbed from the theorem-ide (Lapce fork) workspace root (ws-merge, O-M.1):\n# the four moved crates reference these via `{ workspace = true }`.\n[workspace.package]\nversion      = "0.4.6"\nedition      = "2024"\nrust-version = "1.87.0"\nlicense      = "Apache-2.0"\nhomepage     = "https://lapce.dev"\nauthors      = ["Dongdong Zhou <dzhou121@gmail.com>"]\n\n[workspace.dependencies]')

# 3. fork workspace deps appended to the existing [workspace.dependencies] table
anchor3 = 'ast-grep-config = { version = "=0.44.1", default-features = false }\n\n[patch.crates-io]'
assert anchor3 in s, "ast-grep-config/patch anchor missing"
fork_deps = '''ast-grep-config = { version = "=0.44.1", default-features = false }

# ---- theorem-ide (Lapce fork) workspace deps, merged from apps/theorem-ide/lapce ----
# The floem git pin (31fa8f444c37f4c314f47d88c23ffdbc25f2ab53) travels with
# theorem-ide-app / theorem-ide-core: the wasm frontend's rendering depends on it.
anyhow            = { version = "1.0" }
backtrace         = { version = "0.3" }
chrono            = { version = "0.4" }
clap              = { version = "4.5.0", default-features = false, features = ["std", "help", "usage", "derive"] }
crossbeam-channel = { version = "0.5.12" }
directories       = { version = "4.0.1" }
flate2            = { version = "1.0" }
git2              = { version = "0.20.0", features = ["vendored-openssl"] }
globset           = { version = "0.4.14" }
im                = { version = "15.0.0", features = ["serde"] }
include_dir       = { version = "0.7" }
indexmap          = { version = "2.0", features = ["serde"] }
interprocess      = { version = "1.2.1" }
itertools         = { version = "0.12.1" }
notify            = { version = "5.2.0", features = ["serde"] }
once_cell         = { version = "1.19" }
parking_lot       = { version = "0.12.3" }
rayon             = { version = "1.10.0" }
regex             = { version = "1.10.5" }
reqwest           = { version = "0.11", features = ["blocking", "json", "socks"] }
semver            = { version = "1.0" }
serde             = { version = "1.0" }
serde_json        = { version = "1.0" }
smallvec          = { version = "1.15.1" }
strum             = { version = "0.27.1" }
strum_macros      = { version = "0.27.1" }
tar               = { version = "0.4" }
tempfile          = { version = "3.10.1" }
thiserror         = { version = "1.0" }
toml              = { version = "*" }
toml_edit         = { version = "0.20.2", features = ["serde"] }
url               = { version = "2.5.0" }
zstd              = { version = "0.11.2" }  # follow same version wasmtime-cache in lockfile

lsp-types = { version = "0.95.1", features = ["proposed"] }  # not following semver, so should be locked to patch version updates only
psp-types = { git = "https://github.com/lapce/psp-types", rev = "f7fea28f59e7b2d6faa1034a21679ad49b3524ad" }

lapce-xi-rope = { version = "0.3.2", features = ["serde"] }

theorem-ide-core  = { path = "crates/theorem-ide-core" }
theorem-ide-rpc   = { path = "crates/theorem-ide-rpc" }
theorem-ide-proxy = { path = "crates/theorem-ide-proxy" }

floem = { git = "https://github.com/lapce/floem", rev = "31fa8f444c37f4c314f47d88c23ffdbc25f2ab53", features = ["editor", "serde", "default-image-formats", "rfd-async-std"] }
floem-editor-core = { git = "https://github.com/lapce/floem", rev = "31fa8f444c37f4c314f47d88c23ffdbc25f2ab53", features = ["serde"] }

tracing            = { git = "https://github.com/tokio-rs/tracing", rev = "908cc432a5994f6e17c8f36e13c217dc40085704", package = "tracing" }
tracing-log        = { git = "https://github.com/tokio-rs/tracing", rev = "908cc432a5994f6e17c8f36e13c217dc40085704", package = "tracing-log" }
tracing-subscriber = { git = "https://github.com/tokio-rs/tracing", rev = "908cc432a5994f6e17c8f36e13c217dc40085704", package = "tracing-subscriber" }
tracing-appender   = { git = "https://github.com/tokio-rs/tracing", rev = "908cc432a5994f6e17c8f36e13c217dc40085704", package = "tracing-appender" }

alacritty_terminal = { git = "https://github.com/alacritty/alacritty", rev = "cacdb5bb3b72bad2c729227537979d95af75978f" }

windows-sys = { version = "0", features = ["Win32_Foundation"] }

[patch.crates-io]'''
s = s.replace(anchor3, fork_deps)

# 4. fork patches appended to [patch.crates-io] (after the existing tungstenite patch line)
anchor4 = 'tungstenite = { git = "https://github.com/openai-oss-forks/tungstenite-rs", rev = "4fffad30fe373adbdcffab9545e9e9bf4f2fc19f" }'
assert anchor4 in s, "tungstenite patch anchor missing"
fork_patches = anchor4 + '''

# ---- theorem-ide (Lapce fork) patches, merged from apps/theorem-ide/lapce (no conflicts
# with the substrate's turbovec/biblib/tokio-tungstenite/tungstenite patches) ----
# Temporarily patch lsp-types with a version that adds message-type debug
lsp-types = { git = "https://github.com/lapce/lsp-types", rev = "feaa1e2ec80975c9dadd400a238ceacf071058e6" }
regalloc2 = { rev = "5d79e12d0a93b10fc181f4da409b4671dd365228", git = "https://github.com/bytecodealliance/regalloc2" }

# cargo vendor issue: https://github.com/rust-lang/cargo/issues/10310
# dpi comes from winit (source) and muda (crate)
dpi = { git = "https://github.com/rust-windowing/winit", rev = "ee245c569d65fdeacf705ee5eedb564508d10ebe" }'''
s = s.replace(anchor4, fork_patches)

# 5. fork profiles appended at end (native app build workflows: Makefile --profile release-lto)
s = s.rstrip() + '''

# ---- theorem-ide (Lapce fork) profiles, merged from apps/theorem-ide/lapce ----
# A profile which compiles all (non-workspace) dependencies in release mode
# but Lapce code in dev mode. Use: cargo build --profile fastdev.
[profile.fastdev]
inherits = "dev"
[profile.fastdev.package."*"]
opt-level = 3

[profile.release-lto]
inherits      = "release"
lto           = true
codegen-units = 1
'''

open(P, "w").write(s)
print("Cargo.toml updated OK")
