//! F3 acceptance: the interoperability API seam.
//!
//! Plan acceptance (COMMONPLACE-CONSUMER-LOOP.md, F3):
//! "an external client with a URL and a key reads and writes items; pointing it
//! at a different instance URL connects to that instance's data; an invalid key
//! is rejected."
//!
//! Verified in-process against the live schema (the HTTP layer in main.rs is a
//! thin header -> request-data shim over the same schema.execute path).

use std::sync::Arc;

use async_graphql::{Request, Variables};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use commonplace_api::{build_schema, in_memory_store, ApiKeyRegistry, ApiKeyToken, ConsumerSchema};
use serde_json::json;
use yrs::{Doc, ReadTxn, StateVector, Text, Transact};

fn instance_with_key(key: &str) -> ConsumerSchema {
    let registry = Arc::new(ApiKeyRegistry::new().with_key(key, "instance"));
    build_schema(in_memory_store(), registry)
}

#[tokio::test]
async fn client_with_key_reads_and_writes_items() {
    let key = "valid-key";
    let schema = instance_with_key(key);

    // Write: auto-structuring ingest through the API.
    let mutation = r#"mutation {
        ingest(input: { title: "Ownership", text: "rust ownership and borrowing", kind: "doc" }) {
            id
            kind
            title
            collections
            path
        }
    }"#;
    let response = schema
        .execute(Request::new(mutation).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(
        response.errors.is_empty(),
        "ingest errors: {:?}",
        response.errors
    );
    let data = response.data.into_json().unwrap();
    let id = data["ingest"]["id"].as_str().unwrap().to_string();
    assert!(!id.is_empty());
    assert_eq!(data["ingest"]["kind"], "doc");
    assert!(!data["ingest"]["collections"].as_array().unwrap().is_empty());

    // Read it back by id.
    let query = format!(r#"query {{ item(id: "{id}") {{ id title kind }} }}"#);
    let response = schema
        .execute(Request::new(query).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(
        response.errors.is_empty(),
        "read errors: {:?}",
        response.errors
    );
    let data = response.data.into_json().unwrap();
    assert_eq!(data["item"]["title"], "Ownership");

    // Similarity search returns the item.
    let search =
        r#"query { search(query: "rust ownership borrowing", k: 5) { item { id } score } }"#;
    let response = schema
        .execute(Request::new(search).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(
        response.errors.is_empty(),
        "search errors: {:?}",
        response.errors
    );
    let data = response.data.into_json().unwrap();
    let hits = data["search"].as_array().unwrap();
    assert!(
        hits.iter()
            .any(|hit| hit["item"]["id"] == serde_json::json!(id)),
        "ingested item is searchable through the API"
    );
}

#[tokio::test]
async fn embedding_space_and_vector_neighbors_are_exposed() {
    let key = "valid-key";
    let schema = instance_with_key(key);

    let mutation = r#"mutation {
        rust: ingest(input: { title: "Rust ownership", text: "borrow checker lifetimes ownership", kind: "doc" }) { id }
        swift: ingest(input: { title: "Swift data model", text: "observable state persistence mobile data", kind: "doc" }) { id }
    }"#;
    let response = schema
        .execute(Request::new(mutation).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(
        response.errors.is_empty(),
        "ingest errors: {:?}",
        response.errors
    );
    let data = response.data.into_json().unwrap();
    let rust_id = data["rust"]["id"].as_str().unwrap().to_string();
    let swift_id = data["swift"]["id"].as_str().unwrap().to_string();

    let atlas = r#"query {
        embeddingSpace {
            table
            projection
            total
            rows {
                identifier
                x
                y
                category
                categoryLabel
                text
                createdMs
                communityId
                epistemicStatus
            }
        }
    }"#;
    let response = schema
        .execute(Request::new(atlas).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(
        response.errors.is_empty(),
        "embeddingSpace errors: {:?}",
        response.errors
    );
    let data = response.data.into_json().unwrap();
    assert_eq!(data["embeddingSpace"]["table"], "embedding_space");
    assert_eq!(
        data["embeddingSpace"]["projection"],
        "server:embedding_axes_v1"
    );
    let rows = data["embeddingSpace"]["rows"].as_array().unwrap();
    assert!(rows.len() >= 2);
    assert!(rows
        .iter()
        .any(|row| row["identifier"].as_str() == Some(rust_id.as_str())));
    assert!(rows
        .iter()
        .any(|row| row["identifier"].as_str() == Some(swift_id.as_str())));
    for row in rows {
        assert!(row["x"].as_f64().is_some());
        assert!(row["y"].as_f64().is_some());
        assert!(row["category"].as_i64().is_some());
        assert!(row["createdMs"].as_i64().is_some());
        assert!(row["text"].as_str().unwrap().len() > 3);
    }

    let neighbors = format!(
        r#"query {{ vectorNeighbors(itemId: "{rust_id}", k: 4) {{ row {{ identifier }} score }} }}"#
    );
    let response = schema
        .execute(Request::new(neighbors).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(
        response.errors.is_empty(),
        "vectorNeighbors errors: {:?}",
        response.errors
    );
    let data = response.data.into_json().unwrap();
    let hits = data["vectorNeighbors"].as_array().unwrap();
    assert!(
        hits.iter()
            .all(|hit| hit["row"]["identifier"] != serde_json::json!(rust_id)),
        "seed item must not be returned as its own neighbor"
    );
    assert!(
        hits.iter()
            .any(|hit| hit["row"]["identifier"] == serde_json::json!(swift_id)),
        "second embedded item should be reachable as a vector neighbor"
    );
}

#[tokio::test]
async fn invalid_or_missing_key_is_rejected() {
    let schema = instance_with_key("good-key");
    let query = r#"query { items { id } }"#;

    // Wrong key.
    let response = schema
        .execute(Request::new(query).data(ApiKeyToken("wrong-key".to_string())))
        .await;
    assert!(
        !response.errors.is_empty(),
        "an invalid key must be rejected"
    );

    // No key at all.
    let response = schema.execute(Request::new(query)).await;
    assert!(
        !response.errors.is_empty(),
        "a missing key must be rejected"
    );

    // A write with a bad key must also be rejected and must not mutate.
    let mutation = r#"mutation { putNote(title: "sneaky", text: "x") { id } }"#;
    let response = schema
        .execute(Request::new(mutation).data(ApiKeyToken("wrong-key".to_string())))
        .await;
    assert!(
        !response.errors.is_empty(),
        "an unauthorized write must be rejected"
    );
}

#[tokio::test]
async fn different_instances_have_separate_data() {
    let key = "shared-key";
    let instance_a = instance_with_key(key);
    let instance_b = instance_with_key(key);

    // Write to instance A only.
    let mutation = r#"mutation { putNote(title: "A only", text: "lives in A") { id } }"#;
    let response = instance_a
        .execute(Request::new(mutation).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);

    // Instance B (a different instance URL) has its own, empty dataset.
    let query = r#"query { items { id title } }"#;
    let response = instance_b
        .execute(Request::new(query).data(ApiKeyToken(key.to_string())))
        .await;
    let data = response.data.into_json().unwrap();
    assert_eq!(
        data["items"].as_array().unwrap().len(),
        0,
        "instance B does not see instance A's data"
    );

    // Instance A has exactly the one item.
    let response = instance_a
        .execute(Request::new(query).data(ApiKeyToken(key.to_string())))
        .await;
    let data = response.data.into_json().unwrap();
    let items = data["items"].as_array().unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["title"], "A only");
}

#[tokio::test]
async fn annotations_round_trip_through_graphql_contract() {
    let key = "annotation-key";
    let schema = instance_with_key(key);

    let response = schema
        .execute(
            Request::new(r#"mutation { putNote(title: "Target", text: "annotate me") { id } }"#)
                .data(ApiKeyToken(key.to_string())),
        )
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    let target_id = data["putNote"]["id"].as_str().unwrap().to_string();

    let create = r#"mutation Create($input: CreateAnnotationInput!) {
        createAnnotation(input: $input) {
            id
            targetId
            author
            authorKind
            anchor
            body
            resolved
            resolution { by receipt }
            createdAtMs
        }
    }"#;
    let response = schema
        .execute(
            Request::new(create)
                .variables(Variables::from_json(json!({
                    "input": {
                        "targetId": target_id,
                        "body": "padding wraps the header",
                        "anchor": { "kind": "file_line", "path": "src/App.tsx", "line": 42, "column": 9 },
                        "author": "head:claude",
                        "authorKind": "head"
                    }
                })))
                .data(ApiKeyToken(key.to_string())),
        )
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    let created = &data["createAnnotation"];
    let annotation_id = created["id"].as_str().unwrap().to_string();
    assert_eq!(created["targetId"], json!(target_id));
    assert_eq!(created["author"], "head:claude");
    assert_eq!(created["authorKind"], "head");
    assert_eq!(created["anchor"]["kind"], "file_line");
    assert_eq!(created["anchor"]["line"], 42);
    assert_eq!(created["resolved"], false);
    assert!(created["createdAtMs"].as_i64().unwrap() > 0);

    let reply = r#"mutation Reply($input: ReplyAnnotationInput!) {
        replyAnnotation(input: $input) {
            id
            targetId
            authorKind
            anchor
            body
            resolved
            createdAtMs
        }
    }"#;
    let response = schema
        .execute(
            Request::new(reply)
                .variables(Variables::from_json(json!({
                    "input": {
                        "parentId": annotation_id,
                        "body": "on it",
                        "author": "user:travis",
                        "authorKind": "user"
                    }
                })))
                .data(ApiKeyToken(key.to_string())),
        )
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    assert_eq!(data["replyAnnotation"]["targetId"], json!(annotation_id));
    assert_eq!(data["replyAnnotation"]["authorKind"], "user");
    assert!(data["replyAnnotation"]["anchor"].is_null());

    let list = r#"query List($targetId: String!) {
        annotationsForTarget(targetId: $targetId) {
            id
            targetId
            authorKind
            anchor
            body
            resolved
        }
    }"#;
    let response = schema
        .execute(
            Request::new(list)
                .variables(Variables::from_json(json!({ "targetId": target_id })))
                .data(ApiKeyToken(key.to_string())),
        )
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    let annotations = data["annotationsForTarget"].as_array().unwrap();
    assert_eq!(annotations.len(), 1);
    assert_eq!(annotations[0]["id"], json!(annotation_id));

    let resolve = r#"mutation Resolve($input: ResolveAnnotationInput!) {
        resolveAnnotation(input: $input) {
            id
            resolved
            resolution { by receipt }
        }
    }"#;
    let response = schema
        .execute(
            Request::new(resolve)
                .variables(Variables::from_json(json!({
                    "input": {
                        "id": annotation_id,
                        "by": "commit",
                        "receipt": "abc123"
                    }
                })))
                .data(ApiKeyToken(key.to_string())),
        )
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    assert_eq!(data["resolveAnnotation"]["resolved"], true);
    assert_eq!(data["resolveAnnotation"]["resolution"]["by"], "commit");
    assert_eq!(data["resolveAnnotation"]["resolution"]["receipt"], "abc123");
}

#[tokio::test]
async fn growth_snapshot_is_a_typed_authenticated_query() {
    let key = "growth-key";
    let schema = instance_with_key(key);
    let query = r#"query {
        growthSnapshot {
            available
            message
            snapshot {
                schemaVersion
                source
                tenantSlug
                xp { total byContext { leaf xp } }
                card { stats { form } bundle { manifest { ownerPublicFingerprint } faceSvg } }
            }
        }
    }"#;
    let response = schema
        .execute(Request::new(query).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(
        response.errors.is_empty(),
        "Growth query errors: {:?}",
        response.errors
    );
    let data = response.data.into_json().unwrap();
    let result = &data["growthSnapshot"];
    if result["available"].as_bool() == Some(true) {
        assert_eq!(result["snapshot"]["schemaVersion"], 1);
        assert_eq!(result["snapshot"]["source"], "live");
    } else {
        assert!(result["snapshot"].is_null());
        assert!(result["message"]
            .as_str()
            .is_some_and(|message| !message.is_empty()));
    }

    let unauthorized = schema.execute(Request::new(query)).await;
    assert!(
        !unauthorized.errors.is_empty(),
        "Growth query requires an API key"
    );
}

#[tokio::test]
async fn pm_overview_exposes_project_state_and_work_items() {
    let key = "pm-key";
    let schema = instance_with_key(key);

    let mutation = r##"mutation {
        createPmProject(input: {
            name: "CommonPlace"
            identifier: "CP"
            color: "#2D5F6B"
            defaultStates: true
        }) {
            collection { id name kind identifier featureFlags }
            states { id name group sortOrder }
            openItemCount
        }
    }"##;
    let response = schema
        .execute(Request::new(mutation).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    let project_id = data["createPmProject"]["collection"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    let backlog_state = data["createPmProject"]["states"][0]["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(data["createPmProject"]["collection"]["kind"], "project");
    assert_eq!(data["createPmProject"]["collection"]["identifier"], "CP");
    assert_eq!(
        data["createPmProject"]["collection"]["featureFlags"]["states"],
        true
    );

    let create_item = format!(
        r#"mutation {{
            createWorkItem(input: {{
                title: "Wire PM overview"
                description: "Graph-native Plane parity"
                projectId: "{project_id}"
                stateId: "{backlog_state}"
                priority: "high"
                estimatePoint: 3
            }}) {{
                sequenceId
                state {{ id name group }}
                item {{ id kind title status priority extra }}
                projectIds
                commentCount
                totalWorklogDurationMs
            }}
        }}"#
    );
    let response = schema
        .execute(Request::new(create_item).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    let item_id = data["createWorkItem"]["item"]["id"]
        .as_str()
        .unwrap()
        .to_string();
    assert_eq!(data["createWorkItem"]["sequenceId"], "CP-1");
    assert_eq!(data["createWorkItem"]["state"]["name"], "Backlog");
    assert_eq!(data["createWorkItem"]["item"]["status"], "Backlog");
    assert_eq!(data["createWorkItem"]["item"]["priority"], "high");
    assert_eq!(data["createWorkItem"]["item"]["extra"]["estimate_point"], 3);
    assert_eq!(data["createWorkItem"]["projectIds"][0], project_id);

    let create_page = format!(
        r#"mutation {{
            createPage(input: {{
                projectId: "{project_id}"
                aboutItemId: "{item_id}"
                title: "PM design notes"
                body: "The page and the task share one graph."
                tags: ["plane-parity"]
            }}) {{ id kind title bodyText collections tags }}
        }}"#
    );
    let response = schema
        .execute(Request::new(create_page).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    let page_id = data["createPage"]["id"].as_str().unwrap().to_string();
    assert_eq!(data["createPage"]["kind"], "doc");
    assert_eq!(data["createPage"]["collections"][0], project_id);
    assert_eq!(data["createPage"]["tags"][0], "plane-parity");

    let save_page = format!(
        r#"mutation {{
            savePage(input: {{
                id: "{page_id}"
                title: "PM design notes v2"
                body: "Updated through the Pages contract."
            }}) {{ id title bodyText }}
        }}"#
    );
    let response = schema
        .execute(Request::new(save_page).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    assert_eq!(data["savePage"]["title"], "PM design notes v2");
    assert_eq!(
        data["savePage"]["bodyText"],
        "Updated through the Pages contract."
    );

    let planning = format!(
        r#"mutation {{
            cycle: createPmCycle(input: {{
                projectId: "{project_id}"
                name: "June cycle"
                startAtMs: 1720000000000
                endAtMs: 1720600000000
            }}) {{ id name kind }}
            module: createPmModule(input: {{
                projectId: "{project_id}"
                name: "Data views"
            }}) {{ id name kind }}
        }}"#
    );
    let response = schema
        .execute(Request::new(planning).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    let cycle_id = data["cycle"]["id"].as_str().unwrap().to_string();
    let module_id = data["module"]["id"].as_str().unwrap().to_string();
    assert_eq!(data["cycle"]["kind"], "cycle");
    assert_eq!(data["module"]["kind"], "module");

    let mutations = format!(
        r#"mutation {{
            createWorkItemComment(input: {{
                itemId: "{item_id}"
                body: "Ready for review."
                authorId: "member:travis"
            }}) {{ id kind title bodyText }}
            logWork(input: {{
                taskId: "{item_id}"
                durationMs: 1800000
                loggedBy: "member:travis"
                description: "API contract test"
            }}) {{ id kind extra }}
            addWorkItemToCycle(itemId: "{item_id}", cycleId: "{cycle_id}") {{
                cycleIds
            }}
            addWorkItemToModule(itemId: "{item_id}", moduleId: "{module_id}") {{
                moduleIds
            }}
        }}"#
    );
    let response = schema
        .execute(Request::new(mutations).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    assert_eq!(data["addWorkItemToCycle"]["cycleIds"][0], cycle_id);
    assert_eq!(data["addWorkItemToModule"]["moduleIds"][0], module_id);

    let query = format!(
        r#"query {{
            pmOverview(projectId: "{project_id}") {{
                projects {{
                    collection {{ id name kind }}
                    states {{ name group }}
                    cycles {{ id name kind }}
                    modules {{ id name kind }}
                    workItemCount
                    openItemCount
                }}
                workItems {{
                    sequenceId
                    cycleIds
                    moduleIds
                    commentCount
                    worklogCount
                    totalWorklogDurationMs
                    aboutIds
                    item {{ id title status }}
                }}
                pages {{ id kind title bodyText }}
            }}
        }}"#
    );
    let response = schema
        .execute(Request::new(query).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    assert_eq!(data["pmOverview"]["projects"][0]["workItemCount"], 1);
    assert_eq!(data["pmOverview"]["projects"][0]["openItemCount"], 1);
    assert_eq!(
        data["pmOverview"]["projects"][0]["cycles"][0]["id"],
        cycle_id
    );
    assert_eq!(
        data["pmOverview"]["projects"][0]["modules"][0]["id"],
        module_id
    );
    assert_eq!(data["pmOverview"]["workItems"][0]["sequenceId"], "CP-1");
    assert_eq!(data["pmOverview"]["workItems"][0]["cycleIds"][0], cycle_id);
    assert_eq!(
        data["pmOverview"]["workItems"][0]["moduleIds"][0],
        module_id
    );
    assert_eq!(data["pmOverview"]["workItems"][0]["commentCount"], 1);
    assert_eq!(data["pmOverview"]["workItems"][0]["worklogCount"], 1);
    assert_eq!(
        data["pmOverview"]["workItems"][0]["totalWorklogDurationMs"],
        1_800_000
    );
    assert_eq!(data["pmOverview"]["workItems"][0]["aboutIds"][0], page_id);
    assert_eq!(data["pmOverview"]["pages"][0]["id"], page_id);
    assert_eq!(
        data["pmOverview"]["pages"][0]["title"],
        "PM design notes v2"
    );
}

#[tokio::test]
async fn page_crdt_snapshots_are_owned_by_rustyred_files() {
    let key = "valid-key";
    let schema = instance_with_key(key);

    let create_page = r#"mutation {
        createPage(input: { title: "Collaborative page", body: "" }) {
            id
            kind
        }
    }"#;
    let response = schema
        .execute(Request::new(create_page).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    let page_id = data["createPage"]["id"].as_str().unwrap().to_string();

    let update_bytes = {
        let doc = Doc::new();
        let text = doc.get_or_insert_text("content");
        let mut txn = doc.transact_mut();
        text.insert(&mut txn, 0, "CommonPlace collaborative text");
        drop(txn);
        let update = doc
            .transact()
            .encode_state_as_update_v1(&StateVector::default());
        update
    };
    let update_base64 = BASE64_STANDARD.encode(&update_bytes);
    let store_snapshot = format!(
        r#"mutation {{
            storePageCrdtSnapshot(input: {{
                pageId: "{page_id}"
                updateBase64: "{update_base64}"
                encoding: "yjs-update-v1"
            }}) {{
                pageId
                updateBase64
                encoding
                byteLen
                blobHash
                item {{
                    id
                    kind
                    mime
                    source
                    blobHash
                    extra
                }}
            }}
        }}"#
    );
    let response = schema
        .execute(Request::new(store_snapshot).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    let snapshot = &data["storePageCrdtSnapshot"];
    assert_eq!(snapshot["pageId"], page_id);
    assert_eq!(snapshot["updateBase64"], update_base64);
    assert_eq!(snapshot["encoding"], "yjs-update-v1");
    assert!(snapshot["byteLen"].as_i64().unwrap() > 0);
    assert_eq!(snapshot["item"]["kind"], "file");
    assert_eq!(
        snapshot["item"]["mime"],
        "application/vnd.commonplace.yjs-update-v1"
    );
    assert_eq!(snapshot["item"]["source"], "commonplace.page_crdt_snapshot");
    assert_eq!(
        snapshot["item"]["extra"]["content_role"],
        "page_crdt_snapshot"
    );
    assert_eq!(snapshot["item"]["extra"]["page_id"], page_id);
    assert_eq!(snapshot["item"]["extra"]["hidden"], true);
    assert_eq!(snapshot["blobHash"], snapshot["item"]["blobHash"]);

    let query_snapshot = format!(
        r#"query {{
            pageCrdtSnapshot(pageId: "{page_id}") {{
                pageId
                updateBase64
                encoding
                item {{ id kind extra }}
            }}
        }}"#
    );
    let response = schema
        .execute(Request::new(query_snapshot).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    assert_eq!(data["pageCrdtSnapshot"]["pageId"], page_id);
    assert_eq!(data["pageCrdtSnapshot"]["updateBase64"], update_base64);
    assert_eq!(
        data["pageCrdtSnapshot"]["item"]["extra"]["path"],
        format!(".commonplace/pages/{page_id}/content.yjs")
    );

    let compact = format!(
        r#"mutation {{
            compactPageCrdtSnapshot(pageId: "{page_id}") {{
                pageId
                updateBase64
                encoding
                byteLen
                item {{ id kind extra }}
            }}
        }}"#
    );
    let response = schema
        .execute(Request::new(compact).data(ApiKeyToken(key.to_string())))
        .await;
    assert!(response.errors.is_empty(), "{:?}", response.errors);
    let data = response.data.into_json().unwrap();
    assert_eq!(data["compactPageCrdtSnapshot"]["pageId"], page_id);
    assert_eq!(data["compactPageCrdtSnapshot"]["encoding"], "yjs-update-v1");
    assert_eq!(
        data["compactPageCrdtSnapshot"]["item"]["extra"]["compacted"],
        true
    );
    assert!(!BASE64_STANDARD
        .decode(
            data["compactPageCrdtSnapshot"]["updateBase64"]
                .as_str()
                .unwrap()
        )
        .unwrap()
        .is_empty());
}
