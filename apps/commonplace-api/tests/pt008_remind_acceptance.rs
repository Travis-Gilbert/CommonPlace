//! PT-008 acceptance: `remind_at_ms` through the consumer GraphQL profile.
//!
//! Record 004 (docs/records/004-mobile-app.md): "commonplace-api additive:
//! remind_at_ms scalar (model+GQL+ingest NL date parse echo), edit_item gains
//! status/due/remind". Verified in-process against the live schema, the same
//! way the F3 acceptance drives it.

use std::sync::Arc;

use async_graphql::Request;
use commonplace_api::{build_schema, in_memory_store, ApiKeyRegistry, ApiKeyToken, ConsumerSchema};

const KEY: &str = "remind-key";

fn instance() -> ConsumerSchema {
    let registry = Arc::new(ApiKeyRegistry::new().with_key(KEY, "instance"));
    build_schema(in_memory_store(), registry)
}

async fn execute(schema: &ConsumerSchema, query: &str) -> serde_json::Value {
    let response = schema
        .execute(Request::new(query).data(ApiKeyToken(KEY.to_string())))
        .await;
    assert!(
        response.errors.is_empty(),
        "graphql errors for {query}: {:?}",
        response.errors
    );
    response.data.into_json().unwrap()
}

#[tokio::test]
async fn ingest_echoes_natural_language_reminder_over_graphql() {
    let schema = instance();

    let data = execute(
        &schema,
        r#"mutation {
            ingest(input: { title: "Call mom", text: "call mom friday 9am" }) {
                id
                remindAtMs
                bodyText
            }
        }"#,
    )
    .await;

    let remind = data["ingest"]["remindAtMs"]
        .as_i64()
        .expect("remindAtMs echoed from the phrase");
    assert!(remind > 0, "reminder is a real epoch instant: {remind}");
    // Echo, not rewrite: the captured text is intact.
    assert_eq!(data["ingest"]["bodyText"], "call mom friday 9am");

    // The scalar round-trips through the item query.
    let id = data["ingest"]["id"].as_str().unwrap();
    let read = execute(&schema, &format!(r#"query {{ item(id: "{id}") {{ remindAtMs }} }}"#)).await;
    assert_eq!(read["item"]["remindAtMs"].as_i64(), Some(remind));
}

#[tokio::test]
async fn explicit_ingest_scalars_win_over_the_parser() {
    let schema = instance();

    let data = execute(
        &schema,
        r#"mutation {
            ingest(input: {
                title: "Call mom",
                text: "call mom friday 9am",
                remindAtMs: 1234567,
                dueAtMs: 7654321
            }) {
                remindAtMs
                dueAtMs
            }
        }"#,
    )
    .await;
    assert_eq!(data["ingest"]["remindAtMs"].as_i64(), Some(1_234_567));
    assert_eq!(data["ingest"]["dueAtMs"].as_i64(), Some(7_654_321));
}

#[tokio::test]
async fn edit_item_roundtrips_status_due_and_remind() {
    let schema = instance();

    let data = execute(
        &schema,
        r#"mutation {
            putNote(title: "Follow up", text: "loop back with the vendor") { id }
        }"#,
    )
    .await;
    let id = data["putNote"]["id"].as_str().unwrap().to_string();

    // Set all three new scalars.
    let edited = execute(
        &schema,
        &format!(
            r#"mutation {{
                editItem(id: "{id}", status: "open", dueAtMs: 1900000000000, remindAtMs: 1890000000000) {{
                    status
                    dueAtMs
                    remindAtMs
                }}
            }}"#
        ),
    )
    .await;
    assert_eq!(edited["editItem"]["status"], "open");
    assert_eq!(edited["editItem"]["dueAtMs"].as_i64(), Some(1_900_000_000_000));
    assert_eq!(
        edited["editItem"]["remindAtMs"].as_i64(),
        Some(1_890_000_000_000)
    );

    // Read back through the item query.
    let read = execute(
        &schema,
        &format!(r#"query {{ item(id: "{id}") {{ status dueAtMs remindAtMs }} }}"#),
    )
    .await;
    assert_eq!(read["item"]["status"], "open");
    assert_eq!(read["item"]["dueAtMs"].as_i64(), Some(1_900_000_000_000));
    assert_eq!(read["item"]["remindAtMs"].as_i64(), Some(1_890_000_000_000));

    // -1 clears due and remind, leaves status alone.
    let cleared = execute(
        &schema,
        &format!(
            r#"mutation {{
                editItem(id: "{id}", dueAtMs: -1, remindAtMs: -1) {{
                    status
                    dueAtMs
                    remindAtMs
                }}
            }}"#
        ),
    )
    .await;
    assert_eq!(cleared["editItem"]["status"], "open");
    assert!(cleared["editItem"]["dueAtMs"].is_null());
    assert!(cleared["editItem"]["remindAtMs"].is_null());
}

#[tokio::test]
async fn plain_captures_have_no_reminder() {
    let schema = instance();
    let data = execute(
        &schema,
        r#"mutation {
            ingest(input: { title: "Groceries", text: "milk eggs bread" }) { remindAtMs }
        }"#,
    )
    .await;
    assert!(data["ingest"]["remindAtMs"].is_null());
}
