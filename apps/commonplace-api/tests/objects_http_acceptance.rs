//! SPEC-OBJECT-CONTRACT-V2: the block-view object model over HTTP.
//!
//! `POST /objects/action` (create) files an item, `POST /objects/query` returns
//! it as an ObjectSet, and `GET /objects/views` hydrates the seed registry — all
//! behind the same `x-api-key` gate as `/graphql`. This is the wire the web
//! `HttpBlockHost` rides: the SurfaceRenderer above the BlockHost seam is
//! unchanged whether the host is in-memory or this live substrate.

use std::sync::Arc;

use commonplace_api::{in_memory_store, serve::build_router, ApiKeyRegistry};
use serde_json::json;
use tokio::sync::oneshot;

const KEY: &str = "objects-key";

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
            .expect("serve objects test server");
    });
    (format!("http://127.0.0.1:{port}"), shutdown_tx, server)
}

#[tokio::test]
async fn object_model_round_trips_over_http() {
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();

    // Create an object through the action endpoint.
    let create = client
        .post(format!("{base}/objects/action"))
        .header("x-api-key", KEY)
        .json(&json!({
            "kind": "create",
            "type": "task",
            "props": { "title": "Wired via HTTP", "status": "todo" }
        }))
        .send()
        .await
        .expect("post action");
    assert_eq!(create.status(), reqwest::StatusCode::OK);
    let receipt: serde_json::Value = create.json().await.expect("receipt json");
    assert_eq!(receipt["status"], "applied");
    assert_eq!(receipt["action_kind"], "create");

    // Query it back as an ObjectSet.
    let query = client
        .post(format!("{base}/objects/query"))
        .header("x-api-key", KEY)
        .json(&json!({ "types": ["task"], "live": true }))
        .send()
        .await
        .expect("post query");
    assert_eq!(query.status(), reqwest::StatusCode::OK);
    let set: serde_json::Value = query.json().await.expect("set json");
    let objects = set["objects"].as_array().expect("objects array");
    assert!(
        objects
            .iter()
            .any(|object| object["properties"]["title"] == "Wired via HTTP"),
        "the created task returns in the ObjectSet: {set}"
    );

    // Views hydrate from the seed registry (matches v1 default_commonplace).
    let views = client
        .get(format!("{base}/objects/views"))
        .header("x-api-key", KEY)
        .send()
        .await
        .expect("get views");
    assert_eq!(views.status(), reqwest::StatusCode::OK);
    let descriptors: serde_json::Value = views.json().await.expect("views json");
    let ids: Vec<&str> = descriptors
        .as_array()
        .expect("views array")
        .iter()
        .filter_map(|descriptor| descriptor["id"].as_str())
        .collect();
    assert!(ids.contains(&"table"), "seed registry over HTTP: {ids:?}");

    // The gate holds: no key -> 403.
    let unauth = client
        .post(format!("{base}/objects/query"))
        .json(&json!({ "types": ["task"] }))
        .send()
        .await
        .expect("unauth request");
    assert_eq!(unauth.status(), reqwest::StatusCode::FORBIDDEN);

    let _ = shutdown.send(());
    let _ = server.await;
}
