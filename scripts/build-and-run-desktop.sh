#!/usr/bin/env bash

set -euo pipefail

commonplace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_path="$commonplace_root/apps/desktop/src-tauri/target/release/bundle/macos/CommonPlace.app"

cd "$commonplace_root"
npm run desktop:build -- --bundles app

test -d "$app_path" || {
  echo "CommonPlace.app was not produced at $app_path" >&2
  exit 1
}

osascript -e 'try' \
  -e 'tell application id "me.travisgilbert.commonplace" to quit' \
  -e 'end try'

for _ in {1..50}; do
  app_running="$(
    osascript -e 'application id "me.travisgilbert.commonplace" is running'
  )"
  [[ "$app_running" == "false" ]] && break
  sleep 0.2
done

if [[ "$app_running" != "false" ]]; then
  echo "The existing CommonPlace process did not exit within 10 seconds" >&2
  exit 1
fi

open "$app_path"

echo "Launched $app_path"
