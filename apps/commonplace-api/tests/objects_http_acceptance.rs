//! SPEC-OBJECT-CONTRACT-V2: the block-view object model over HTTP.
//!
//! `POST /objects/action` (create) files an item, `POST /objects/query` returns
//! it as an ObjectSet, and `GET /objects/views` hydrates the seed registry — all
//! behind the same `x-api-key` gate as `/graphql`. This is the wire the web
//! `HttpBlockHost` rides: the SurfaceRenderer above the BlockHost seam is
//! unchanged whether the host is in-memory or this live substrate.

use std::sync::Arc;
use std::{
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use commonplace_api::{in_memory_store, redcore_store, serve::build_router, ApiKeyRegistry};
use serde_json::json;
use tokio::sync::oneshot;

const KEY: &str = "objects-key";

struct TestDataDir(PathBuf);

impl TestDataDir {
    fn new() -> Self {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "commonplace-api-cn4-{}-{suffix}",
            std::process::id()
        ));
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestDataDir {
    fn drop(&mut self) {
        if self
            .0
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with("commonplace-api-cn4-"))
        {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
}

async fn spawn_router() -> (String, oneshot::Sender<()>, tokio::task::JoinHandle<()>) {
    let registry = Arc::new(ApiKeyRegistry::new().with_key(KEY, "instance"));
    let app = build_router(in_memory_store(), registry);
    spawn_app(app).await
}

async fn spawn_app(
    app: axum::Router,
) -> (String, oneshot::Sender<()>, tokio::task::JoinHandle<()>) {
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
async fn canvas_and_chat_work_survive_object_seam_restart() {
    let data_dir = TestDataDir::new();
    let registry = || Arc::new(ApiKeyRegistry::new().with_key(KEY, "instance"));

    let first_store = redcore_store(data_dir.path()).expect("open first durable store");
    let (base, shutdown, server) = spawn_app(build_router(first_store, registry())).await;
    let client = reqwest::Client::new();

    for (type_ref, props) in [
        (
            "canvas",
            json!({
                "id": "canvas.default",
                "title": "Canvas",
                "persistence_kind": "canvas-work-v1",
                "graph": {
                    "id": "canvas.default",
                    "title": "Canvas",
                    "tenant": "authenticated-object-seam",
                    "placements": [{
                        "canvasId": "canvas.default",
                        "objectId": "note.restart",
                        "x": 40,
                        "y": 80,
                        "width": 240,
                        "height": 120
                    }],
                    "groups": [],
                    "connections": [],
                    "objects": [{
                        "id": "note.restart",
                        "type": "note",
                        "title": "Survives"
                    }]
                }
            }),
        ),
        (
            "chat-thread",
            json!({
                "id": "chat-thread:restart",
                "title": "Durable transcript",
                "projectId": "chat-project:default",
                "sessionId": "runtime-hint-only",
                "sessionResumable": false,
                "updatedAt": 1,
                "messages": [
                    { "id": "message-1", "role": "user", "text": "Persist this" },
                    { "id": "message-2", "role": "assistant", "text": "Persisted" }
                ],
                "persistence_kind": "chat-transcript-v1"
            }),
        ),
    ] {
        let response = client
            .post(format!("{base}/objects/action"))
            .header("x-api-key", KEY)
            .json(&json!({ "kind": "create", "type": type_ref, "props": props }))
            .send()
            .await
            .expect("persist work object");
        assert_eq!(response.status(), reqwest::StatusCode::OK);
    }

    let _ = shutdown.send(());
    let _ = server.await;

    let reopened_store = redcore_store(data_dir.path()).expect("reopen durable store");
    let (base, shutdown, server) = spawn_app(build_router(reopened_store, registry())).await;
    let response = client
        .post(format!("{base}/objects/query"))
        .header("x-api-key", KEY)
        .json(&json!({ "types": ["canvas", "chat-thread"], "page": { "limit": 10 } }))
        .send()
        .await
        .expect("query reopened work");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let set: serde_json::Value = response.json().await.expect("reopened set json");
    let objects = set["objects"].as_array().expect("reopened objects");
    let canvas = objects
        .iter()
        .find(|object| object["id"] == "canvas.default")
        .expect("canvas survived");
    assert_eq!(
        canvas["properties"]["graph"]["placements"][0]["objectId"],
        "note.restart"
    );
    let thread = objects
        .iter()
        .find(|object| object["id"] == "chat-thread:restart")
        .expect("thread survived");
    assert_eq!(thread["properties"]["messages"][1]["text"], "Persisted");
    assert_eq!(thread["properties"]["sessionResumable"], false);

    let _ = shutdown.send(());
    let _ = server.await;
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

#[tokio::test]
async fn layout_objects_round_trip_with_stable_ids_over_http() {
    // B6b: surface / region / view-instance persist through /objects with pinned
    // ids and ordered CONTAINS (move), then query returns the tree.
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();

    for (type_ref, id, props) in [
        (
            "surface",
            "console-chat",
            json!({ "id": "console-chat", "name": "Chat", "kind": "chat", "active": true }),
        ),
        (
            "region",
            "chat.region-editor",
            json!({ "id": "chat.region-editor", "kind": "editor", "size": 100 }),
        ),
        (
            "view-instance",
            "chat.vi-surface",
            json!({
                "id": "chat.vi-surface",
                "title": "Chat",
                "descriptor_id": "chat.surface",
                "query": { "types": ["thread"] }
            }),
        ),
    ] {
        let create = client
            .post(format!("{base}/objects/action"))
            .header("x-api-key", KEY)
            .json(&json!({ "kind": "create", "type": type_ref, "props": props }))
            .send()
            .await
            .expect("create layout object");
        assert_eq!(create.status(), reqwest::StatusCode::OK);
        let receipt: serde_json::Value = create.json().await.expect("receipt");
        assert_eq!(receipt["status"], "applied");
        assert_eq!(receipt["target_ids"][0], id);
    }

    for (child, parent, order) in [
        ("chat.region-editor", "console-chat", 1.0),
        ("chat.vi-surface", "chat.region-editor", 1.0),
    ] {
        let move_action = client
            .post(format!("{base}/objects/action"))
            .header("x-api-key", KEY)
            .json(&json!({
                "kind": "move",
                "id": child,
                "new_parent": parent,
                "order": order
            }))
            .send()
            .await
            .expect("move contains");
        assert_eq!(move_action.status(), reqwest::StatusCode::OK);
    }

    let query = client
        .post(format!("{base}/objects/query"))
        .header("x-api-key", KEY)
        .json(&json!({
            "types": ["surface", "region", "view-instance"],
            "traverse": [{ "edge": "CONTAINS", "dir": "out" }]
        }))
        .send()
        .await
        .expect("query layout");
    assert_eq!(query.status(), reqwest::StatusCode::OK);
    let set: serde_json::Value = query.json().await.expect("set json");
    let objects = set["objects"].as_array().expect("objects");
    assert_eq!(objects.len(), 3);
    let surface = objects
        .iter()
        .find(|object| object["id"] == "console-chat")
        .expect("surface");
    assert_eq!(surface["type"], "surface");
    assert_eq!(surface["properties"]["name"], "Chat");
    assert_eq!(
        surface["relations"]["CONTAINS"],
        json!(["chat.region-editor"])
    );
    let region = objects
        .iter()
        .find(|object| object["id"] == "chat.region-editor")
        .expect("region");
    assert_eq!(
        region["relations"]["CONTAINS"],
        json!(["chat.vi-surface"])
    );

    let _ = shutdown.send(());
    let _ = server.await;
}
