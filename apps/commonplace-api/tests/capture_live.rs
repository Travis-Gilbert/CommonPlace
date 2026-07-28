//! SPEC-THEOREM-CAPTURE-2.0 D0: prove the shipped capture surface over HTTP
//! before extending it.

use std::sync::Arc;

use commonplace_api::{in_memory_store, serve::build_router, ApiKeyRegistry};
use reqwest::multipart::{Form, Part};
use serde_json::json;
use tokio::sync::oneshot;

const KEY: &str = "capture-live-key";

async fn spawn_router() -> (String, oneshot::Sender<()>, tokio::task::JoinHandle<()>) {
    let registry = Arc::new(ApiKeyRegistry::new().with_key(KEY, "capture-live"));
    let app = build_router(in_memory_store(), registry);
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .expect("bind ephemeral capture-live port");
    let port = listener.local_addr().expect("capture-live address").port();
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await
            .expect("serve capture-live router");
    });
    (format!("http://127.0.0.1:{port}"), shutdown_tx, server)
}

#[tokio::test]
async fn running_capture_surface_round_trips_item_and_blob() {
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();
    let bytes = b"capture 2.0 live smoke bytes".to_vec();

    let health = client
        .get(format!("{base}/healthz"))
        .send()
        .await
        .expect("GET /healthz");
    assert_eq!(health.status(), reqwest::StatusCode::OK);

    let auth_probe = json!({
        "client_id": "auth-probe",
        "body": "authorization must run before ingestion",
        "object_type": "note",
        "capture_method": "agent",
        "source": "api",
        "captured_at": "2026-07-28T00:00:00Z"
    });
    let missing_key = client
        .post(format!("{base}/ingest/capture"))
        .json(&auth_probe)
        .send()
        .await
        .expect("POST capture without API key");
    assert_eq!(missing_key.status(), reqwest::StatusCode::FORBIDDEN);
    let ambiguous_key = client
        .post(format!("{base}/ingest/capture"))
        .header("x-api-key", KEY)
        .bearer_auth("different-key")
        .json(&auth_probe)
        .send()
        .await
        .expect("POST capture with conflicting API keys");
    assert_eq!(ambiguous_key.status(), reqwest::StatusCode::FORBIDDEN);

    let capture = client
        .post(format!("{base}/ingest/blob"))
        .header("x-api-key", KEY)
        .multipart(
            Form::new().text("title", "D0 live capture").part(
                "file",
                Part::bytes(bytes.clone())
                    .file_name("capture.txt")
                    .mime_str("text/plain")
                    .expect("text/plain mime"),
            ),
        )
        .send()
        .await
        .expect("POST /ingest/blob");
    assert_eq!(capture.status(), reqwest::StatusCode::OK);
    let item: serde_json::Value = capture.json().await.expect("capture ItemGql");
    let id = item["id"].as_str().expect("non-empty capture id");
    assert!(!id.is_empty());
    let kind = item["kind"].as_str().expect("capture kind");
    let blob_hash = item["blobHash"].as_str().expect("capture blob hash");

    let query = client
        .post(format!("{base}/objects/query"))
        .header("x-api-key", KEY)
        .json(&json!({
            "types": [kind],
            "where": {
                "kind": "eq",
                "field": "id",
                "value": id
            },
            "live": false
        }))
        .send()
        .await
        .expect("POST /objects/query");
    assert_eq!(query.status(), reqwest::StatusCode::OK);
    let set: serde_json::Value = query.json().await.expect("capture ObjectSet");
    assert!(
        set["objects"]
            .as_array()
            .is_some_and(|objects| objects.iter().any(|object| object["id"] == id)),
        "captured item resolves through /objects/query: {set}"
    );

    let blob = client
        .get(format!("{base}/blob/{blob_hash}"))
        .header("x-api-key", KEY)
        .send()
        .await
        .expect("GET /blob/{hash}");
    assert_eq!(blob.status(), reqwest::StatusCode::OK);
    assert_eq!(blob.bytes().await.expect("capture blob bytes"), bytes);

    let _ = shutdown.send(());
    server.await.expect("capture server task");
}

#[tokio::test]
async fn canonical_json_capture_is_flexible_authenticated_and_idempotent() {
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();
    let capture = json!({
        "client_id": "local-json-contract",
        "title": "Canonical capture",
        "body": "The same markdown must survive a retry.",
        "object_type": "note",
        "capture_method": " Wormhole ",
        "source": "api",
        "captured_at": "2026-07-27T16:30:00-04:00",
        "source_url": "https://example.com/capture-contract",
        "properties": {
            "topic": "capture",
            "tags": "contract,live"
        }
    });

    let first = client
        .post(format!("{base}/ingest/capture"))
        .bearer_auth(KEY)
        .header(reqwest::header::CONTENT_TYPE, "Application/JSON")
        .body(capture.to_string())
        .send()
        .await
        .expect("POST JSON capture with Bearer auth");
    assert_eq!(first.status(), reqwest::StatusCode::OK);
    let first: serde_json::Value = first.json().await.expect("first capture receipt");
    assert_eq!(first["created"], true);
    assert_eq!(first["clientId"], "local-json-contract");
    assert_eq!(first["extra"]["capture_method"], "wormhole");
    let id = first["id"].as_str().expect("first capture id");

    let retry = client
        .post(format!("{base}/ingest/capture"))
        .header("x-api-key", KEY)
        .json(&capture)
        .send()
        .await
        .expect("retry JSON capture with x-api-key");
    assert_eq!(retry.status(), reqwest::StatusCode::OK);
    let retry: serde_json::Value = retry.json().await.expect("retry capture receipt");
    assert_eq!(retry["id"], id);
    assert_eq!(retry["created"], false);

    let query = client
        .post(format!("{base}/objects/query"))
        .header("x-api-key", KEY)
        .json(&json!({
            "types": ["note"],
            "where": {
                "kind": "eq",
                "field": "id",
                "value": id
            },
            "live": false
        }))
        .send()
        .await
        .expect("query canonical capture");
    assert_eq!(query.status(), reqwest::StatusCode::OK);
    let set: serde_json::Value = query.json().await.expect("canonical ObjectSet");
    assert_eq!(set["objects"][0]["id"], id);
    assert_eq!(
        set["objects"][0]["properties"]["capture_method"],
        "wormhole"
    );

    let mut other_surface = capture.clone();
    other_surface["client_id"] = json!("local-other-surface");
    let distinct = client
        .post(format!("{base}/ingest/capture"))
        .header("x-api-key", KEY)
        .json(&other_surface)
        .send()
        .await
        .expect("same content from a distinct surface");
    assert_eq!(distinct.status(), reqwest::StatusCode::OK);
    let distinct: serde_json::Value = distinct.json().await.expect("distinct capture receipt");
    assert_ne!(distinct["id"], id);
    assert_eq!(distinct["created"], true);

    let invalid_reference = json!({
        "client_id": "invalid-blob-reference",
        "body": "Reject malformed content-addressed references.",
        "object_type": "note",
        "capture_method": "agent",
        "source": "api",
        "captured_at": "2026-07-27T16:30:00-04:00",
        "attachments": [{
            "blob_hash": "../../not-a-content-hash"
        }]
    });
    let invalid = client
        .post(format!("{base}/ingest/capture"))
        .header("x-api-key", KEY)
        .json(&invalid_reference)
        .send()
        .await
        .expect("POST capture with malformed blob hash");
    assert_eq!(invalid.status(), reqwest::StatusCode::BAD_REQUEST);
    assert_eq!(
        invalid.text().await.expect("invalid blob response"),
        "attachment blob_hash must be sha256:<64 hex characters>"
    );

    let _ = shutdown.send(());
    server.await.expect("capture server task");
}

#[tokio::test]
async fn canonical_multipart_and_legacy_replay_share_the_capture_core() {
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();
    let pdf = b"%PDF-1.7\ncapture contract fixture\n%%EOF".to_vec();
    let envelope = json!({
        "client_id": "local-pet-drop",
        "title": "Dropped fixture.pdf",
        "body": "",
        "object_type": "file",
        "capture_method": "dropped",
        "source": "pet",
        "captured_at": "2026-07-27T20:31:00Z",
        "properties": {}
    });

    let dropped = client
        .post(format!("{base}/ingest/capture"))
        .header("x-api-key", KEY)
        .multipart(
            Form::new()
                .part(
                    "capture",
                    Part::text(envelope.to_string())
                        .mime_str("application/json")
                        .expect("application/json mime"),
                )
                .part(
                    "file",
                    Part::bytes(pdf.clone())
                        .file_name("fixture.pdf")
                        .mime_str("application/pdf")
                        .expect("application/pdf mime"),
                ),
        )
        .send()
        .await
        .expect("POST canonical multipart capture");
    assert_eq!(dropped.status(), reqwest::StatusCode::OK);
    let dropped: serde_json::Value = dropped.json().await.expect("drop receipt");
    assert_eq!(dropped["extra"]["capture_method"], "dropped");
    assert_eq!(dropped["extra"]["capture_source"], "pet");
    let dropped_id = dropped["id"].as_str().expect("drop id");
    let hash = dropped["blobHash"].as_str().expect("drop blob hash");
    let bytes = client
        .get(format!("{base}/blob/{hash}"))
        .header("x-api-key", KEY)
        .send()
        .await
        .expect("read dropped blob");
    assert_eq!(bytes.status(), reqwest::StatusCode::OK);
    assert_eq!(bytes.bytes().await.expect("dropped blob bytes"), pdf);

    let referenced = json!({
        "client_id": "local-reference-only",
        "title": "Referenced fixture",
        "object_type": "file",
        "capture_method": "agent",
        "source": "api",
        "captured_at": "2026-07-27T20:32:00Z",
        "attachments": [{
            "blob_hash": hash,
            "file_name": "fixture.pdf",
            "mime": "application/pdf"
        }]
    });
    let referenced = client
        .post(format!("{base}/ingest/capture"))
        .header("x-api-key", KEY)
        .json(&referenced)
        .send()
        .await
        .expect("POST attachment-only reference without body");
    assert_eq!(referenced.status(), reqwest::StatusCode::OK);

    let repeat_drop = client
        .post(format!("{base}/ingest/capture"))
        .header("x-api-key", KEY)
        .multipart(
            Form::new()
                .part(
                    "capture",
                    Part::text(envelope.to_string())
                        .mime_str("application/json")
                        .expect("application/json mime"),
                )
                .part(
                    "file",
                    Part::bytes(pdf.clone())
                        .file_name("fixture.pdf")
                        .mime_str("application/pdf")
                        .expect("application/pdf mime"),
                ),
        )
        .send()
        .await
        .expect("repeat canonical multipart capture");
    assert_eq!(repeat_drop.status(), reqwest::StatusCode::OK);
    let repeat_drop: serde_json::Value = repeat_drop.json().await.expect("repeat drop receipt");
    assert_eq!(repeat_drop["id"], dropped_id);
    assert_eq!(repeat_drop["created"], false);

    let distinct_drop = client
        .post(format!("{base}/ingest/capture"))
        .header("x-api-key", KEY)
        .multipart(
            Form::new()
                .part(
                    "capture",
                    Part::text(envelope.to_string())
                        .mime_str("application/json")
                        .expect("application/json mime"),
                )
                .part(
                    "file",
                    Part::bytes(b"%PDF-1.7\ndifferent fixture\n%%EOF".to_vec())
                        .file_name("fixture.pdf")
                        .mime_str("application/pdf")
                        .expect("application/pdf mime"),
                ),
        )
        .send()
        .await
        .expect("distinct canonical multipart capture");
    assert_eq!(distinct_drop.status(), reqwest::StatusCode::OK);
    let distinct_drop: serde_json::Value =
        distinct_drop.json().await.expect("distinct drop receipt");
    assert_ne!(distinct_drop["id"], dropped_id);
    assert_eq!(distinct_drop["created"], true);

    let boundary = "capture-live-fixed-boundary";
    let legacy_bytes = format!(
        "--{boundary}\r\n\
         Content-Disposition: form-data; name=\"title\"\r\n\r\n\
         Recorded legacy request\r\n\
         --{boundary}\r\n\
         Content-Disposition: form-data; name=\"kind\"\r\n\r\n\
         file\r\n\
         --{boundary}\r\n\
         Content-Disposition: form-data; name=\"file\"; filename=\"recorded.txt\"\r\n\
         Content-Type: text/plain\r\n\r\n\
         byte-identical legacy body\r\n\
         --{boundary}--\r\n"
    )
    .into_bytes();
    let send_legacy = || {
        client
            .post(format!("{base}/ingest/blob"))
            .header("x-api-key", KEY)
            .header(
                reqwest::header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(legacy_bytes.clone())
    };
    let first = send_legacy()
        .send()
        .await
        .expect("first recorded legacy request");
    assert_eq!(first.status(), reqwest::StatusCode::OK);
    let first: serde_json::Value = first.json().await.expect("first legacy receipt");
    assert_eq!(first["created"], true);
    let replay = send_legacy()
        .send()
        .await
        .expect("byte-identical legacy replay");
    assert_eq!(replay.status(), reqwest::StatusCode::OK);
    let replay: serde_json::Value = replay.json().await.expect("legacy replay receipt");
    assert_eq!(replay["id"], first["id"]);
    assert_eq!(replay["created"], false);

    let inferred_image = client
        .post(format!("{base}/ingest/blob"))
        .header("x-api-key", KEY)
        .multipart(
            Form::new().text("title", "Legacy image").part(
                "file",
                Part::bytes(vec![0x89, b'P', b'N', b'G'])
                    .file_name("legacy.png")
                    .mime_str("image/png")
                    .expect("image/png mime"),
            ),
        )
        .send()
        .await
        .expect("POST legacy image without kind hint");
    assert_eq!(inferred_image.status(), reqwest::StatusCode::OK);
    let inferred_image: serde_json::Value =
        inferred_image.json().await.expect("legacy image receipt");
    assert_eq!(inferred_image["kind"], "image");

    let _ = shutdown.send(());
    server.await.expect("capture server task");
}
