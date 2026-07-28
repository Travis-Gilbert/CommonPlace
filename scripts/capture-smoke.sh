#!/usr/bin/env bash
set -euo pipefail

readonly API_BASE_URL="${COMMONPLACE_API_URL:-http://127.0.0.1:50090}"
readonly API_KEY="${COMMONPLACE_API_KEY:-dev-key}"
readonly CONNECT_TIMEOUT_SECONDS="${COMMONPLACE_CAPTURE_CONNECT_TIMEOUT_SECONDS:-5}"
readonly MAX_TIME_SECONDS="${COMMONPLACE_CAPTURE_MAX_TIME_SECONDS:-30}"
readonly CURL_TIMEOUT_ARGS=(
    --connect-timeout "$CONNECT_TIMEOUT_SECONDS"
    --max-time "$MAX_TIME_SECONDS"
)

for dependency in curl jq; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        echo "capture smoke requires $dependency" >&2
        exit 2
    fi
done

TEMP_DIR="$(mktemp -d)"
readonly TEMP_DIR
cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

readonly INPUT_FILE="$TEMP_DIR/capture-smoke.txt"
readonly OUTPUT_FILE="$TEMP_DIR/capture-smoke.out"
printf '%s' 'capture 2.0 smoke bytes' >"$INPUT_FILE"

health_status="$(curl "${CURL_TIMEOUT_ARGS[@]}" \
    --silent --show-error --output /dev/null --write-out '%{http_code}' \
    "$API_BASE_URL/healthz")"
if [[ "$health_status" != "200" ]]; then
    echo "GET /healthz returned HTTP $health_status" >&2
    exit 1
fi

capture_json="$(curl "${CURL_TIMEOUT_ARGS[@]}" --fail --silent --show-error \
    --header "x-api-key: $API_KEY" \
    --form 'title=Capture 2.0 smoke' \
    --form "file=@$INPUT_FILE;type=text/plain" \
    "$API_BASE_URL/ingest/blob")"
item_id="$(jq -er '.id | select(length > 0)' <<<"$capture_json")"
item_kind="$(jq -er '.kind | select(length > 0)' <<<"$capture_json")"
blob_hash="$(jq -er '.blobHash | select(length > 0)' <<<"$capture_json")"

retry_capture_json="$(curl "${CURL_TIMEOUT_ARGS[@]}" --fail --silent --show-error \
    --header "x-api-key: $API_KEY" \
    --form 'title=Capture 2.0 smoke' \
    --form "file=@$INPUT_FILE;type=text/plain" \
    "$API_BASE_URL/ingest/blob")"
retry_item_id="$(jq -er '.id | select(length > 0)' <<<"$retry_capture_json")"
retry_blob_hash="$(jq -er '.blobHash | select(length > 0)' <<<"$retry_capture_json")"
retry_created="$(jq -er '.created' <<<"$retry_capture_json")"
if [[ "$retry_item_id" != "$item_id" || "$retry_blob_hash" != "$blob_hash" ]]; then
    echo "legacy capture retry created a different object or blob" >&2
    exit 1
fi
if [[ "$retry_created" != "false" ]]; then
    echo "legacy capture retry did not report created=false" >&2
    exit 1
fi

canonical_payload="$(jq -cn \
    --arg captured_at '2026-07-28T00:00:00Z' \
    '{
        client_id:"capture-smoke-canonical",
        title:"Capture 2.0 canonical smoke",
        body:"canonical capture smoke",
        object_type:"note",
        capture_method:"agent",
        source:"api",
        captured_at:$captured_at
    }')"
canonical_json="$(curl "${CURL_TIMEOUT_ARGS[@]}" --fail --silent --show-error \
    --header "authorization: Bearer $API_KEY" \
    --header 'content-type: application/json' \
    --data "$canonical_payload" \
    "$API_BASE_URL/ingest/capture")"
canonical_id="$(jq -er '.id | select(length > 0)' <<<"$canonical_json")"
canonical_retry_json="$(curl "${CURL_TIMEOUT_ARGS[@]}" --fail --silent --show-error \
    --header "authorization: Bearer $API_KEY" \
    --header 'content-type: application/json' \
    --data "$canonical_payload" \
    "$API_BASE_URL/ingest/capture")"
canonical_retry_id="$(jq -er '.id | select(length > 0)' <<<"$canonical_retry_json")"
canonical_retry_created="$(jq -er '.created' <<<"$canonical_retry_json")"
if [[ "$canonical_retry_id" != "$canonical_id" || "$canonical_retry_created" != "false" ]]; then
    echo "canonical capture retry was not idempotent" >&2
    exit 1
fi

query_json="$(jq -cn \
    --arg id "$item_id" \
    --arg type "$item_kind" \
    '{types:[$type],where:{kind:"eq",field:"id",value:$id},live:false}')"
object_set="$(curl "${CURL_TIMEOUT_ARGS[@]}" --fail --silent --show-error \
    --header "content-type: application/json" \
    --header "x-api-key: $API_KEY" \
    --data "$query_json" \
    "$API_BASE_URL/objects/query")"
jq -e --arg id "$item_id" '.objects | any(.id == $id)' \
    >/dev/null <<<"$object_set"

curl "${CURL_TIMEOUT_ARGS[@]}" --fail --silent --show-error \
    --header "x-api-key: $API_KEY" \
    --output "$OUTPUT_FILE" \
    "$API_BASE_URL/blob/$blob_hash"
cmp "$INPUT_FILE" "$OUTPUT_FILE"

jq -cn \
    --arg id "$item_id" \
    --arg blob_hash "$blob_hash" \
    '{status:"ok",id:$id,blobHash:$blob_hash}'
