//! PT-017 (server half) acceptance: the multipart blob capture seam.
//!
//! Record 004 (docs/records/004-mobile-app.md): multipart `POST /ingest/blob`
//! stores bytes via the BlobStore and runs the ingest pipeline (right ItemKind,
//! blob_hash, mime), and `GET /blob/{hash}` serves the bytes back with the
//! item's mime, both behind the same `x-api-key` gate as `/graphql`.
//!
//! Runs the real router over an ephemeral loopback port (multipart needs the
//! HTTP layer, not just schema.execute).

use std::sync::Arc;

use commonplace_api::{in_memory_store, serve::build_router, ApiKeyRegistry};
use reqwest::multipart::{Form, Part};
use tokio::sync::oneshot;

const KEY: &str = "blob-key";

async fn spawn_router() -> (String, oneshot::Sender<()>, tokio::task::JoinHandle<()>) {
    let registry = Arc::new(ApiKeyRegistry::new().with_key(KEY, "instance"));
    let app = build_router(in_memory_store(), registry);
    let listener = tokio::net::TcpListener::bind(("127.0.0.1", 0))
        .await
        .expect("bind ephemeral port");
    let port = listener.local_addr().expect("local addr").port();
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let server = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
            })
            .await
            .expect("serve blob test server");
    });
    (format!("http://127.0.0.1:{port}"), shutdown_tx, server)
}

fn capture_form(bytes: Vec<u8>) -> Form {
    Form::new()
        .text("title", "Receipt photo")
        .text("kind", "image")
        .text("tags", "receipts, finance")
        .text("text", "remind me tomorrow at 9 to expense this")
        .part(
            "file",
            Part::bytes(bytes)
                .file_name("receipt.png")
                .mime_str("image/png")
                .expect("mime"),
        )
}

#[tokio::test]
async fn blob_capture_files_an_item_and_serves_bytes_back() {
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();
    let bytes = b"png-ish bytes for the blob store".to_vec();

    // Capture: authenticated multipart POST.
    let response = client
        .post(format!("{base}/ingest/blob"))
        .header("x-api-key", KEY)
        .multipart(capture_form(bytes.clone()))
        .send()
        .await
        .expect("post capture");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = response.json().await.expect("json body");

    assert!(!body["id"].as_str().unwrap_or_default().is_empty());
    assert_eq!(body["kind"], "image");
    assert_eq!(body["title"], "Receipt photo");
    assert_eq!(body["mime"], "image/png");
    let blob_hash = body["blobHash"].as_str().expect("blobHash on receipt");
    assert!(blob_hash.starts_with("sha256:"), "content address: {blob_hash}");
    assert!(
        !body["classification"].as_str().unwrap_or_default().is_empty(),
        "ingest classified the capture: {body}"
    );
    assert!(!body["collections"].as_array().unwrap().is_empty());
    let tags: Vec<&str> = body["tags"]
        .as_array()
        .unwrap()
        .iter()
        .filter_map(|tag| tag.as_str())
        .collect();
    assert_eq!(tags, vec!["receipts", "finance"]);
    assert!(
        body["remindAtMs"].as_i64().unwrap_or_default() > 0,
        "caption reminder phrase echoed: {body}"
    );
    assert!(body["createdAtMs"].as_i64().unwrap_or_default() > 0);

    // Render path: GET /blob/{hash} returns the bytes with the item's mime.
    let blob = client
        .get(format!("{base}/blob/{blob_hash}"))
        .header("x-api-key", KEY)
        .send()
        .await
        .expect("get blob");
    assert_eq!(blob.status(), reqwest::StatusCode::OK);
    assert_eq!(
        blob.headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|value| value.to_str().ok()),
        Some("image/png")
    );
    assert_eq!(blob.bytes().await.expect("blob bytes").to_vec(), bytes);

    // Unknown hash is a 404.
    let missing = client
        .get(format!("{base}/blob/sha256:{}", "0".repeat(64)))
        .header("x-api-key", KEY)
        .send()
        .await
        .expect("get missing blob");
    assert_eq!(missing.status(), reqwest::StatusCode::NOT_FOUND);

    let _ = shutdown.send(());
    let _ = server.await;
}

#[tokio::test]
async fn blob_routes_reject_missing_or_invalid_keys() {
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();

    let no_key = client
        .post(format!("{base}/ingest/blob"))
        .multipart(capture_form(b"bytes".to_vec()))
        .send()
        .await
        .expect("post without key");
    assert_eq!(no_key.status(), reqwest::StatusCode::FORBIDDEN);

    let bad_key = client
        .get(format!("{base}/blob/sha256:{}", "0".repeat(64)))
        .header("x-api-key", "wrong-key")
        .send()
        .await
        .expect("get with wrong key");
    assert_eq!(bad_key.status(), reqwest::StatusCode::FORBIDDEN);

    let _ = shutdown.send(());
    let _ = server.await;
}

#[tokio::test]
async fn blob_capture_requires_a_file_and_infers_kind_from_mime() {
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();

    // No file field: 400.
    let no_file = client
        .post(format!("{base}/ingest/blob"))
        .header("x-api-key", KEY)
        .multipart(Form::new().text("title", "Nothing here"))
        .send()
        .await
        .expect("post without file");
    assert_eq!(no_file.status(), reqwest::StatusCode::BAD_REQUEST);

    // Audio kind hint lands as an audio item (voice capture path).
    let voice = client
        .post(format!("{base}/ingest/blob"))
        .header("x-api-key", KEY)
        .multipart(
            Form::new().text("kind", "audio").part(
                "file",
                Part::bytes(b"m4a bytes".to_vec())
                    .file_name("memo.m4a")
                    .mime_str("audio/mp4")
                    .expect("mime"),
            ),
        )
        .send()
        .await
        .expect("post voice capture");
    assert_eq!(voice.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = voice.json().await.expect("json body");
    assert_eq!(body["kind"], "audio");
    // No title field: the filename stands in.
    assert_eq!(body["title"], "memo.m4a");
    assert_eq!(body["mime"], "audio/mp4");

    // No kind hint: mime infers the kind.
    let inferred = client
        .post(format!("{base}/ingest/blob"))
        .header("x-api-key", KEY)
        .multipart(
            Form::new().text("title", "Scan").part(
                "file",
                Part::bytes(b"pdf bytes".to_vec())
                    .file_name("scan.pdf")
                    .mime_str("application/pdf")
                    .expect("mime"),
            ),
        )
        .send()
        .await
        .expect("post file capture");
    assert_eq!(inferred.status(), reqwest::StatusCode::OK);
    let body: serde_json::Value = inferred.json().await.expect("json body");
    assert_eq!(body["kind"], "file");
    assert_eq!(body["mime"], "application/pdf");

    let _ = shutdown.send(());
    let _ = server.await;
}
