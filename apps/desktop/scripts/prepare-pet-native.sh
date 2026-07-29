#!/usr/bin/env bash

set -euo pipefail

desktop_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
commonplace_root="$(cd "$desktop_dir/../.." && pwd)"
theorem_root="${THEOREM_SOURCE_ROOT:-$commonplace_root/../Theorem}"
theorem_pet_rev="b02a09efc9a03622f57cb515dd7ffd621f7bc426"
helper_dir="$theorem_root/apps/theorem-voice-helper"
destination_dir="$desktop_dir/src-tauri/binaries"

command -v rustc >/dev/null 2>&1 || {
  echo "rustc is required to resolve the Tauri sidecar target triple" >&2
  exit 1
}
command -v swift >/dev/null 2>&1 || {
  echo "Swift is required to build the local CommonPlace voice helper" >&2
  exit 1
}
git -C "$theorem_root" cat-file -e "$theorem_pet_rev^{commit}" 2>/dev/null || {
  echo "Theorem source at $theorem_root does not contain PET revision $theorem_pet_rev" >&2
  exit 1
}
git -C "$theorem_root" diff --quiet "$theorem_pet_rev" -- apps/theorem-voice-helper || {
  echo "Theorem voice helper differs from pinned PET revision $theorem_pet_rev" >&2
  echo "Set THEOREM_SOURCE_ROOT to a checkout of that revision before packaging." >&2
  exit 1
}
untracked_helper_files="$(
  git -C "$theorem_root" ls-files \
    --others \
    --exclude-standard \
    -- apps/theorem-voice-helper
)"
if [[ -n "$untracked_helper_files" ]]; then
  echo "Theorem voice helper contains files outside pinned PET revision $theorem_pet_rev:" >&2
  printf '%s\n' "$untracked_helper_files" >&2
  echo "Set THEOREM_SOURCE_ROOT to a clean checkout of that revision before packaging." >&2
  exit 1
fi
test -f "$helper_dir/Package.swift" || {
  echo "Theorem voice helper source was not found at $helper_dir" >&2
  exit 1
}

target_triple="${TAURI_ENV_TARGET_TRIPLE:-${CARGO_BUILD_TARGET:-}}"
if [[ -z "$target_triple" ]]; then
  target_triple="$(rustc -vV | awk '/^host: / { print $2 }')"
fi
test -n "$target_triple" || {
  echo "Could not resolve the Tauri target triple" >&2
  exit 1
}
destination="$destination_dir/theorem-voice-helper-$target_triple"

mkdir -p "$destination_dir"

build_helper() {
  local swift_triple="$1"
  local bin_path

  swift build \
    --package-path "$helper_dir" \
    --configuration release \
    --triple "$swift_triple" >&2
  bin_path="$(
    swift build \
      --package-path "$helper_dir" \
      --configuration release \
      --triple "$swift_triple" \
      --show-bin-path
  )"
  test -x "$bin_path/theorem-voice-helper" || {
    echo "Swift did not produce the voice helper for $swift_triple" >&2
    exit 1
  }
  printf '%s\n' "$bin_path/theorem-voice-helper"
}

case "$target_triple" in
  aarch64-apple-darwin)
    helper_binary="$(build_helper "arm64-apple-macosx")"
    cp "$helper_binary" "$destination"
    ;;
  x86_64-apple-darwin)
    helper_binary="$(build_helper "x86_64-apple-macosx")"
    cp "$helper_binary" "$destination"
    ;;
  universal-apple-darwin)
    command -v lipo >/dev/null 2>&1 || {
      echo "lipo is required to build the universal CommonPlace voice helper" >&2
      exit 1
    }
    arm64_binary="$(build_helper "arm64-apple-macosx")"
    x86_64_binary="$(build_helper "x86_64-apple-macosx")"
    lipo -create "$arm64_binary" "$x86_64_binary" -output "$destination"
    ;;
  *)
    echo "The CommonPlace voice helper does not support Tauri target $target_triple" >&2
    exit 1
    ;;
esac

chmod 755 "$destination"

echo "Prepared CommonPlace voice sidecar at $destination"
