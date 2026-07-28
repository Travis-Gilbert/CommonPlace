#!/usr/bin/env bash
set -euo pipefail

readonly API_BASE_URL="${COMMONPLACE_API_URL:-http://127.0.0.1:50090}"
readonly API_KEY="${COMMONPLACE_API_KEY:-dev-key}"

for dependency in curl jq; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        echo "capture smoke requires $dependency" >&2
        exit 2
    fi
done

readonly TEMP_DIR="$(mktemp -d)"
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

readonly INPUT_FILE="$TEMP_DIR/capture-smoke.txt"
readonly OUTPUT_FILE="$TEMP_DIR/capture-smoke.out"
printf '%s' 'capture 2.0 smoke bytes' >"$INPUT_FILE"

health_status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' \
    "$API_BASE_URL/healthz")"
if [[ "$health_status" != "200" ]]; then
    echo "GET /healthz returned HTTP $health_status" >&2
    exit 1
fi

capture_json="$(curl --fail --silent --show-error \
    --header "x-api-key: $API_KEY" \
    --form 'title=Capture 2.0 smoke' \
    --form "file=@$INPUT_FILE;type=text/plain" \
    "$API_BASE_URL/ingest/blob")"
item_id="$(jq -er '.id | select(length > 0)' <<<"$capture_json")"
item_kind="$(jq -er '.kind | select(length > 0)' <<<"$capture_json")"
blob_hash="$(jq -er '.blobHash | select(length > 0)' <<<"$capture_json")"

query_json="$(jq -cn \
    --arg id "$item_id" \
    --arg type "$item_kind" \
    '{types:[$type],where:{kind:"eq",field:"id",value:$id},live:false}')"
object_set="$(curl --fail --silent --show-error \
    --header "content-type: application/json" \
    --header "x-api-key: $API_KEY" \
    --data "$query_json" \
    "$API_BASE_URL/objects/query")"
jq -e --arg id "$item_id" '.objects | any(.id == $id)' \
    >/dev/null <<<"$object_set"

curl --fail --silent --show-error \
    --header "x-api-key: $API_KEY" \
    --output "$OUTPUT_FILE" \
    "$API_BASE_URL/blob/$blob_hash"
cmp "$INPUT_FILE" "$OUTPUT_FILE"

jq -cn \
    --arg id "$item_id" \
    --arg blob_hash "$blob_hash" \
    '{status:"ok",id:$id,blobHash:$blob_hash}'
