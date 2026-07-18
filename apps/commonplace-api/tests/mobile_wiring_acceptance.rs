//! Record 007: authenticated mobile bootstrap and exact capability catalog.

use std::sync::Arc;

use commonplace::{Item, ItemKind};
use commonplace_api::{in_memory_store, serve::build_router, ApiKeyRegistry};
use tokio::sync::oneshot;

const KEY: &str = "mobile-wiring-key";

async fn spawn_router() -> (String, oneshot::Sender<()>, tokio::task::JoinHandle<()>) {
    let store = in_memory_store();
    {
        let mut commonplace = store.lock().expect("mobile catalog store lock");
        commonplace
            .put_item(
                Item::new(ItemKind::from("plugin".to_string()), "Theorems Harness")
                    .with_text("Grounded theorem runtime and review tools."),
            )
            .expect("seed plugin");
        commonplace
            .put_item(
                Item::new(ItemKind::from("skill".to_string()), "Planning theorem")
                    .with_text("Create an executable theorem plan."),
            )
            .expect("seed skill");
    }
    let registry = Arc::new(ApiKeyRegistry::new().with_key(KEY, "mobile"));
    let app = build_router(store, registry);
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
            .expect("serve mobile wiring test server");
    });
    (format!("http://127.0.0.1:{port}"), shutdown_tx, server)
}

#[tokio::test]
async fn mobile_bootstrap_and_catalog_are_authenticated_and_normalized() {
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();

    let unauthenticated = client
        .get(format!("{base}/mobile/catalog"))
        .send()
        .await
        .expect("unauthenticated catalog request");
    assert_eq!(unauthenticated.status(), reqwest::StatusCode::FORBIDDEN);

    let capabilities = client
        .get(format!("{base}/capabilities"))
        .header("x-api-key", KEY)
        .send()
        .await
        .expect("capabilities request");
    assert_eq!(capabilities.status(), reqwest::StatusCode::OK);
    let capabilities: serde_json::Value = capabilities.json().await.expect("capabilities json");
    assert_eq!(capabilities["capability_catalog"], true);
    assert!(capabilities.get("chat_url").is_some());
    assert!(capabilities.get("push_registration_url").is_some());
    assert!(capabilities.get("expo_project_id").is_some());

    let catalog = client
        .get(format!("{base}/mobile/catalog"))
        .header("x-api-key", KEY)
        .send()
        .await
        .expect("catalog request");
    assert_eq!(catalog.status(), reqwest::StatusCode::OK);
    let catalog: serde_json::Value = catalog.json().await.expect("catalog json");
    let plugin = catalog["plugins"]
        .as_array()
        .expect("plugins array")
        .iter()
        .find(|entry| entry["name"] == "Theorems Harness")
        .expect("seed plugin in catalog");
    assert_eq!(plugin["kind"], "plugin");
    assert_eq!(
        plugin["description"],
        "Grounded theorem runtime and review tools."
    );
    let skill = catalog["skills"]
        .as_array()
        .expect("skills array")
        .iter()
        .find(|entry| entry["name"] == "Planning theorem")
        .expect("seed skill in catalog");
    assert_eq!(skill["kind"], "skill");

    let _ = shutdown.send(());
    let _ = server.await;
}
