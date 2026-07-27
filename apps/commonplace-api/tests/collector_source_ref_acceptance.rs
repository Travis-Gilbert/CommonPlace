//! FK7 acceptance for the collector's stable source identity.
//!
//! The Express peer sends parsed text through GraphQL. Repeating the same
//! source reference must update one graph item so a retry cannot duplicate
//! user content.

use std::sync::Arc;

use commonplace_api::{in_memory_store, serve::build_router, ApiKeyRegistry};
use serde_json::{json, Value};
use tokio::sync::oneshot;

const KEY: &str = "collector-source-ref-key";

async fn spawn_router() -> (String, oneshot::Sender<()>, tokio::task::JoinHandle<()>) {
    let registry = Arc::new(ApiKeyRegistry::new().with_key(KEY, "collector-test"));
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
            .expect("serve collector source-ref test");
    });
    (format!("http://127.0.0.1:{port}"), shutdown_tx, server)
}

async fn graphql(client: &reqwest::Client, base: &str, body: Value) -> Value {
    let response = client
        .post(format!("{base}/graphql"))
        .header("x-api-key", KEY)
        .json(&body)
        .send()
        .await
        .expect("send GraphQL request");
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let payload: Value = response.json().await.expect("GraphQL JSON");
    assert!(
        payload.get("errors").is_none(),
        "GraphQL request must succeed: {payload}"
    );
    payload
}

#[tokio::test]
async fn repeated_collector_source_ref_updates_one_graph_item() {
    let (base, shutdown, server) = spawn_router().await;
    let client = reqwest::Client::new();
    let mutation = r#"
      mutation Ingest($input: IngestInputGql!) {
        ingest(input: $input) {
          id
          title
          bodyText
          source
        }
      }
    "#;
    let source_ref = json!({
        "source": "upload://workspace-42/research.txt",
        "externalId": "workspace:workspace-42:sha256:document"
    });

    let first = graphql(
        &client,
        &base,
        json!({
            "query": mutation,
            "variables": {
                "input": {
                    "title": "Research",
                    "text": "first parsed body",
                    "kind": "doc",
                    "source": "collector://first-pass",
                    "sourceRef": source_ref
                }
            }
        }),
    )
    .await;
    let first_id = first["data"]["ingest"]["id"]
        .as_str()
        .expect("first item id")
        .to_string();
    assert_eq!(first["data"]["ingest"]["source"], "collector://first-pass");

    let second = graphql(
        &client,
        &base,
        json!({
            "query": mutation,
            "variables": {
                "input": {
                    "title": "Research revised",
                    "text": "second parsed body",
                    "kind": "doc",
                    "source": "collector://second-pass",
                    "sourceRef": source_ref
                }
            }
        }),
    )
    .await;
    assert_eq!(second["data"]["ingest"]["id"], first_id);
    assert_eq!(second["data"]["ingest"]["bodyText"], "second parsed body");
    assert_eq!(
        second["data"]["ingest"]["source"],
        "collector://second-pass"
    );

    let listed = graphql(
        &client,
        &base,
        json!({ "query": "query Items { items { id } }" }),
    )
    .await;
    assert_eq!(listed["data"]["items"].as_array().expect("items").len(), 1);

    let _ = shutdown.send(());
    let _ = server.await;
}
