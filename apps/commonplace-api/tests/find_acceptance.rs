//! B7 acceptance: the GraphQL find surface and the saveUrl mutation.
//!
//! Spec acceptance (SPEC-COMMONPLACE-SEARCH-STACK-1.0, B7):
//! "authed `find` over a seeded store returns lane-attributed hits; `saveUrl`
//! followed by `find` at Corpus scope surfaces the saved page; the saved item
//! appears in the existing `briefing` query; unauthed requests are rejected by
//! the existing key auth."
//!
//! The save path uses an offline page source, so these tests never reach the
//! network. The seam is real: production builds the live fetch cascade.

use std::sync::Arc;

use async_graphql::Request;
use commonplace_api::save_url::PageSource;
use commonplace_api::schema::build_schema_with_page_source;
use commonplace_api::{in_memory_store, ApiKeyRegistry, ApiKeyToken, ConsumerSchema};

const KEY: &str = "key";
const SAVED_URL: &str = "https://example.test/membrane-admission";

fn instance() -> ConsumerSchema {
    let registry = Arc::new(ApiKeyRegistry::new().with_key(KEY, "instance"));
    let pages = PageSource::fixture([(
        SAVED_URL,
        "Membrane admission",
        "the membrane admits candidates under a token budget and defers the rest",
    )]);
    build_schema_with_page_source(in_memory_store(), registry, Arc::new(pages))
}

async fn exec(schema: &ConsumerSchema, query: impl Into<String>) -> serde_json::Value {
    let response = schema
        .execute(Request::new(query).data(ApiKeyToken(KEY.to_string())))
        .await;
    assert!(
        response.errors.is_empty(),
        "gql errors: {:?}",
        response.errors
    );
    response.data.into_json().unwrap()
}

async fn exec_unauthed(schema: &ConsumerSchema, query: impl Into<String>) -> Vec<String> {
    let response = schema.execute(Request::new(query)).await;
    response
        .errors
        .into_iter()
        .map(|error| error.message)
        .collect()
}

const FIND_QUERY: &str = r#"
query Find($q: String!, $lanes: [FindLane!]) {
  find(query: $q, lanes: $lanes, k: 20) {
    query
    lambda
    retrievalRef
    scopesSearched
    lanes { lane seeded admitted degradedReason }
    results {
      score
      relation
      edges { id type }
      hit { doc lane title source snippet byteRange { start end } scope { kind } }
    }
  }
}
"#;

async fn find(schema: &ConsumerSchema, query: &str) -> serde_json::Value {
    let request = Request::new(FIND_QUERY)
        .variables(async_graphql::Variables::from_json(
            serde_json::json!({ "q": query }),
        ))
        .data(ApiKeyToken(KEY.to_string()));
    let response = schema.execute(request).await;
    assert!(
        response.errors.is_empty(),
        "gql errors: {:?}",
        response.errors
    );
    response.data.into_json().unwrap()["find"].clone()
}

async fn seed_docs(schema: &ConsumerSchema) {
    exec(
        schema,
        r#"mutation { ingest(input: { title: "Membrane notes", text: "the membrane admits candidates and defers the rest", kind: "doc" }) { id } }"#,
    )
    .await;
    exec(
        schema,
        r#"mutation { ingest(input: { title: "Frontier", text: "trigram indexes narrow the scan before verification", kind: "doc" }) { id } }"#,
    )
    .await;
}

#[tokio::test]
async fn authed_find_over_a_seeded_store_returns_lane_attributed_hits() {
    let schema = instance();
    seed_docs(&schema).await;

    let found = find(&schema, "candidates").await;
    let results = found["results"].as_array().expect("results");
    assert!(!results.is_empty(), "seeded store returned no hits");

    for result in results {
        let lane = result["hit"]["lane"].as_str().expect("lane");
        assert!(
            ["EXACT", "LEXICAL", "SEMANTIC", "STRUCTURAL"].contains(&lane),
            "unexpected lane {lane}"
        );
        assert_eq!(result["hit"]["scope"]["kind"], "CORPUS");
        let relation = result["relation"].as_str().expect("relation");
        assert!(
            ["KNOWN", "EXTENDS", "CONTRADICTS", "ORPHAN"].contains(&relation),
            "unexpected relation {relation}"
        );
        assert!(result["edges"].is_array(), "edges must always be present");
        assert!(result["hit"]["byteRange"]["start"].is_number());
    }

    assert_eq!(found["scopesSearched"], serde_json::json!(["corpus"]));
    assert_eq!(found["lanes"].as_array().expect("lanes").len(), 4);
    assert!(found["retrievalRef"]
        .as_str()
        .expect("retrievalRef")
        .starts_with("find:retrieval:"));
}

#[tokio::test]
async fn disabling_a_lane_through_graphql_removes_only_that_lanes_hits() {
    let schema = instance();
    seed_docs(&schema).await;

    let all = find(&schema, "candidates").await;
    let request = Request::new(FIND_QUERY)
        .variables(async_graphql::Variables::from_json(serde_json::json!({
            "q": "candidates",
            "lanes": ["LEXICAL", "SEMANTIC", "STRUCTURAL"],
        })))
        .data(ApiKeyToken(KEY.to_string()));
    let response = schema.execute(request).await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let without_exact = response.data.into_json().unwrap()["find"].clone();

    let lanes_of = |value: &serde_json::Value| -> Vec<String> {
        value["results"]
            .as_array()
            .expect("results")
            .iter()
            .map(|result| result["hit"]["lane"].as_str().unwrap_or_default().to_string())
            .collect()
    };
    assert!(lanes_of(&all).iter().any(|lane| lane == "EXACT"));
    assert!(!lanes_of(&without_exact).iter().any(|lane| lane == "EXACT"));

    let exact_receipt = without_exact["lanes"]
        .as_array()
        .expect("lanes")
        .iter()
        .find(|receipt| receipt["lane"] == "EXACT")
        .expect("exact receipt")
        .clone();
    assert_eq!(exact_receipt["degradedReason"], "lane disabled by request");
}

#[tokio::test]
async fn save_url_then_find_at_corpus_scope_surfaces_the_saved_page() {
    let schema = instance();

    let saved = exec(
        &schema,
        format!(
            r#"mutation {{ saveUrl(url: "{SAVED_URL}") {{ itemId collectionId collectionName title url }} }}"#
        ),
    )
    .await;
    let receipt = &saved["saveUrl"];
    let item_id = receipt["itemId"].as_str().expect("itemId").to_string();
    assert_eq!(receipt["url"], SAVED_URL);
    assert_eq!(receipt["title"], "Membrane admission");

    let found = find(&schema, "membrane").await;
    let docs: Vec<String> = found["results"]
        .as_array()
        .expect("results")
        .iter()
        .map(|result| result["hit"]["doc"].as_str().unwrap_or_default().to_string())
        .collect();
    assert!(
        docs.contains(&item_id),
        "saved page {item_id} not found at Corpus scope; got {docs:?}"
    );
}

#[tokio::test]
async fn save_url_returns_the_real_collection_name_from_the_ingest_receipt() {
    let schema = instance();
    let saved = exec(
        &schema,
        format!(r#"mutation {{ saveUrl(url: "{SAVED_URL}") {{ collectionId collectionName }} }}"#),
    )
    .await;
    let name = saved["saveUrl"]["collectionName"]
        .as_str()
        .expect("collectionName");
    assert!(!name.trim().is_empty(), "collection name was blank");
    for placeholder in ["placeholder", "unknown", "untitled", "default", "todo"] {
        assert!(
            !name.to_ascii_lowercase().contains(placeholder),
            "collection name {name:?} looks like a placeholder"
        );
    }
    assert!(!saved["saveUrl"]["collectionId"]
        .as_str()
        .expect("collectionId")
        .is_empty());
}

#[tokio::test]
async fn saved_item_appears_in_the_existing_briefing_query() {
    let schema = instance();
    let saved = exec(
        &schema,
        format!(r#"mutation {{ saveUrl(url: "{SAVED_URL}") {{ itemId }} }}"#),
    )
    .await;
    let item_id = saved["saveUrl"]["itemId"].as_str().expect("itemId");

    let briefing = exec(&schema, "{ briefing { recent { id title } } }").await;
    let recent = briefing["briefing"]["recent"]
        .as_array()
        .expect("recent")
        .iter()
        .map(|item| item["id"].as_str().unwrap_or_default().to_string())
        .collect::<Vec<_>>();
    assert!(
        recent.iter().any(|id| id == item_id),
        "saved item missing from briefing; got {recent:?}"
    );
}

#[tokio::test]
async fn save_url_refuses_a_page_it_cannot_fetch() {
    let schema = instance();
    let errors = schema
        .execute(
            Request::new(r#"mutation { saveUrl(url: "https://example.test/absent") { itemId } }"#)
                .data(ApiKeyToken(KEY.to_string())),
        )
        .await
        .errors
        .into_iter()
        .map(|error| error.message)
        .collect::<Vec<_>>();
    assert!(
        errors.iter().any(|message| message.contains("page_not_found")),
        "expected a named fetch failure, got {errors:?}"
    );
}

#[tokio::test]
async fn unauthed_find_is_rejected_by_key_auth() {
    let schema = instance();
    let errors = exec_unauthed(&schema, r#"{ find(query: "candidates") { query } }"#).await;
    assert!(
        errors.iter().any(|message| message.contains("API key")),
        "expected a key auth refusal, got {errors:?}"
    );
}

#[tokio::test]
async fn unauthed_save_url_is_rejected_by_key_auth() {
    let schema = instance();
    let errors = exec_unauthed(
        &schema,
        format!(r#"mutation {{ saveUrl(url: "{SAVED_URL}") {{ itemId }} }}"#),
    )
    .await;
    assert!(
        errors.iter().any(|message| message.contains("API key")),
        "expected a key auth refusal, got {errors:?}"
    );
}

#[tokio::test]
async fn scatter_never_exceeds_eight_aspects_and_carries_its_scene() {
    let schema = instance();
    seed_docs(&schema).await;

    let scattered = exec(
        &schema,
        r#"{ scatter(query: "membrane", k: 50) { aspects { id label relation edges { target weight } } lambda labeler scatterRef sceneRefusal scene { sceneId } } }"#,
    )
    .await;
    let response = &scattered["scatter"];
    let aspects = response["aspects"].as_array().expect("aspects");
    assert!(aspects.len() <= 8, "scatter returned {} aspects", aspects.len());
    for aspect in aspects {
        let label = aspect["label"].as_str().expect("label");
        assert!(!label.trim().is_empty(), "aspect label was blank");
    }
    // The scene either compiled or said why. Never a fabricated empty scene.
    assert!(
        response["scene"].is_object() || response["sceneRefusal"].is_string(),
        "scatter returned neither a scene nor a refusal"
    );
    assert!(response["scatterRef"].as_str().is_some());
}

#[tokio::test]
async fn expand_refuses_a_blank_aspect_id() {
    let schema = instance();
    let errors = schema
        .execute(
            Request::new(r#"{ expand(query: "membrane", aspectId: "  ") { scatterRef } }"#)
                .data(ApiKeyToken(KEY.to_string())),
        )
        .await
        .errors
        .into_iter()
        .map(|error| error.message)
        .collect::<Vec<_>>();
    assert!(
        errors.iter().any(|message| message.contains("aspectId")),
        "expected a named refusal, got {errors:?}"
    );
}

#[tokio::test]
async fn page_scope_without_a_node_id_is_refused() {
    let schema = instance();
    let errors = schema
        .execute(
            Request::new(
                r#"{ find(query: "membrane", scopes: [{ kind: PAGE }]) { retrievalRef } }"#,
            )
            .data(ApiKeyToken(KEY.to_string())),
        )
        .await
        .errors
        .into_iter()
        .map(|error| error.message)
        .collect::<Vec<_>>();
    assert!(
        errors.iter().any(|message| message.contains("nodeId")),
        "expected a named refusal, got {errors:?}"
    );
}
