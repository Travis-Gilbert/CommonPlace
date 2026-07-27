//! F2 acceptance: auto-structuring ingest.
//!
//! Plan acceptance:
//! "a dropped document or image is embedded, classified into a collection, filed
//! into the folder tree, linked to similar items, and made
//! similarity-searchable with no user action; a near-duplicate entity resolves
//! to the existing one."

use commonplace::{
    Commonplace, Embedder, InMemoryBlobStore, IngestInput, IngestPipeline, ItemKind, Residency,
    SourceRef, ENTITY_LABEL, ITEM_EMBEDDING_PROPERTY, MENTIONS_ENTITY_EDGE, SIMILAR_TO_EDGE,
};
use rustyred_thg_core::{
    read_vector_property, GraphSnapshotSource, GraphStoreResult, GraphVectorPayloadAccess,
    InMemoryGraphStore, NeighborQuery, NodeQuery,
};

fn fresh() -> Commonplace<InMemoryGraphStore, InMemoryBlobStore> {
    Commonplace::new(InMemoryGraphStore::new(), InMemoryBlobStore::new())
}

#[derive(Clone, Copy)]
struct TopicEmbedder;

impl Embedder for TopicEmbedder {
    fn dimension(&self) -> usize {
        2
    }

    fn embed_text(&self, text: &str) -> GraphStoreResult<Vec<f32>> {
        let text = text.to_ascii_lowercase();
        if text.contains("old-topic") || text.contains("acme") {
            Ok(vec![1.0, 0.0])
        } else if text.contains("new-topic") || text.contains("globex") {
            Ok(vec![0.0, 1.0])
        } else {
            Ok(vec![0.5, 0.5])
        }
    }

    fn embed_image(&self, _bytes: &[u8], _mime: Option<&str>) -> GraphStoreResult<Vec<f32>> {
        Ok(vec![0.5, 0.5])
    }
}

#[test]
fn document_ingest_auto_structures_without_user_action() {
    let mut cp = fresh();
    let pipeline = IngestPipeline::default();

    let receipt = pipeline
        .ingest(
            &mut cp,
            IngestInput::document(
                "Acme contract memo",
                "Client: Acme Corp. Contract review for indemnity and venue clauses.",
            )
            .with_source("dropzone")
            .with_residency(Residency::Synced),
        )
        .unwrap();

    assert_eq!(receipt.item.kind, ItemKind::Doc);
    assert_eq!(receipt.item.residency, Residency::Synced);
    assert!(receipt.item.embedding_ref.is_some());
    assert_eq!(receipt.collection.name, "Legal");
    assert!(receipt.item.collections.contains(&receipt.collection.id));
    assert_eq!(
        receipt
            .item
            .extra
            .get("folder_path")
            .and_then(|v| v.as_str()),
        Some(receipt.folder_path.as_str())
    );
    assert!(receipt.folder_path.starts_with("collections/legal/"));
    assert!(!receipt.embedding.is_empty());

    let collection_items = cp.collection_items(&receipt.collection.id).unwrap();
    assert_eq!(collection_items.len(), 1);
    assert_eq!(collection_items[0].id, receipt.item.id);

    let search = pipeline.search(&cp, "indemnity contract venue", 1).unwrap();
    assert_eq!(search[0].0, receipt.item.id);
    let item_node = cp.store().get_node(&receipt.item.id).unwrap();
    assert!(
        item_node
            .properties
            .get(ITEM_EMBEDDING_PROPERTY)
            .is_some_and(serde_json::Value::is_object),
        "embedding is a strict top-level vector reference"
    );
    assert!(
        receipt
            .item
            .extra
            .get(ITEM_EMBEDDING_PROPERTY)
            .is_some_and(serde_json::Value::is_object),
        "the hydrated item carries the same strict vector reference"
    );
    let payloads = cp.store().vector_payload_store().unwrap();
    let round_trip = read_vector_property(item_node, ITEM_EMBEDDING_PROPERTY, payloads.as_ref())
        .unwrap()
        .expect("vector payload");
    assert_eq!(round_trip, receipt.embedding);
}

#[test]
fn related_documents_are_linked_to_similar_items() {
    let mut cp = fresh();
    let pipeline = IngestPipeline::default();

    let first = pipeline
        .ingest(
            &mut cp,
            IngestInput::document(
                "Lease review",
                "Client: Acme Corp. Lease contract with indemnity language.",
            ),
        )
        .unwrap();
    let second = pipeline
        .ingest(
            &mut cp,
            IngestInput::document(
                "Lease follow-up",
                "Client: Acme Corp. Follow-up contract memo about indemnity and lease terms.",
            ),
        )
        .unwrap();

    assert!(
        second
            .similar_items
            .iter()
            .any(|link| link.item_id == first.item.id),
        "second ingest links to the earlier similar document"
    );
    let similar_neighbors = cp
        .store()
        .neighbors(NeighborQuery::out(&second.item.id).with_edge_type(SIMILAR_TO_EDGE));
    assert_eq!(similar_neighbors[0].node_id, first.item.id);
}

#[test]
fn image_ingest_embeds_classifies_files_and_resolves_blob() {
    let mut cp = fresh();
    let pipeline = IngestPipeline::default();
    let bytes = b"\x89PNG\r\ncommonplace-image-payload".to_vec();

    let receipt = pipeline
        .ingest(
            &mut cp,
            IngestInput::image("Lobby photo", bytes.clone(), Some("image/png".to_string()))
                .with_tags(["photos"]),
        )
        .unwrap();

    assert_eq!(receipt.item.kind, ItemKind::Image);
    assert_eq!(receipt.collection.name, "Photos");
    let blob = cp.read_blob(&receipt.item).unwrap().expect("image blob");
    assert_eq!(blob, bytes);

    let search = pipeline
        .search_embedding(&cp, &receipt.embedding, 1)
        .unwrap();
    assert_eq!(search[0].0, receipt.item.id);
}

#[test]
fn near_duplicate_entities_resolve_to_existing_entity_node() {
    let mut cp = fresh();
    let pipeline = IngestPipeline::default();

    let first = pipeline
        .ingest(
            &mut cp,
            IngestInput::document(
                "Initial matter",
                "Client: Acme Corp. Intake notes for contract dispute.",
            ),
        )
        .unwrap();
    let second = pipeline
        .ingest(
            &mut cp,
            IngestInput::document(
                "Follow-up matter",
                "Client: ACME Corporation. Follow-up notes for the same contract dispute.",
            ),
        )
        .unwrap();

    assert_eq!(first.entities.len(), 1);
    assert_eq!(second.entities.len(), 1);
    assert_eq!(first.entities[0].entity_id, second.entities[0].entity_id);

    let entities = cp
        .store()
        .query_nodes(NodeQuery::label(ENTITY_LABEL).with_limit(usize::MAX));
    assert_eq!(entities.len(), 1);
    let mentions = cp
        .store()
        .neighbors(NeighborQuery::out(&second.item.id).with_edge_type(MENTIONS_ENTITY_EDGE));
    assert_eq!(mentions[0].node_id, first.entities[0].entity_id);
}

#[test]
fn source_ref_update_reconciles_similarity_and_entity_edges() {
    let mut cp = fresh();
    let pipeline = IngestPipeline::new(TopicEmbedder)
        .without_content_core()
        .with_similarity_threshold(0.9);
    let old_neighbor = pipeline
        .ingest(
            &mut cp,
            IngestInput::document("Old neighbor", "old-topic reference"),
        )
        .unwrap();
    let new_neighbor = pipeline
        .ingest(
            &mut cp,
            IngestInput::document("New neighbor", "new-topic reference"),
        )
        .unwrap();
    let source_ref = SourceRef::new("collector", "stable-document");
    let initial = pipeline
        .ingest(
            &mut cp,
            IngestInput::document("Tracked source", "old-topic material\nClient: Acme Corp.")
                .with_source_ref(source_ref.clone()),
        )
        .unwrap();
    let old_similarity_edge_id = format!("similar:{}:{}", initial.item.id, old_neighbor.item.id);
    let old_entity_edge_id = format!("mentions:{}:entity:acme-corp", initial.item.id);

    assert!(cp
        .store()
        .neighbors(NeighborQuery::out(&initial.item.id).with_edge_type(SIMILAR_TO_EDGE))
        .iter()
        .any(|hit| hit.node_id == old_neighbor.item.id));
    assert!(cp
        .store()
        .neighbors(NeighborQuery::out(&initial.item.id).with_edge_type(MENTIONS_ENTITY_EDGE))
        .iter()
        .any(|hit| hit.node_id == "entity:acme-corp"));
    let later_old_neighbor = pipeline
        .ingest(
            &mut cp,
            IngestInput::document("Later old neighbor", "old-topic follow-up"),
        )
        .unwrap();
    let incoming_old_similarity_edge_id =
        format!("similar:{}:{}", later_old_neighbor.item.id, initial.item.id);
    assert!(cp
        .store()
        .neighbors(NeighborQuery::in_(&initial.item.id).with_edge_type(SIMILAR_TO_EDGE))
        .iter()
        .any(|hit| hit.node_id == later_old_neighbor.item.id));

    let updated = pipeline
        .ingest(
            &mut cp,
            IngestInput::document(
                "Tracked source revised",
                "new-topic material\nClient: Globex LLC.",
            )
            .with_source_ref(source_ref),
        )
        .unwrap();
    assert_eq!(updated.item.id, initial.item.id);

    let similarity_neighbors = cp
        .store()
        .neighbors(NeighborQuery::out(&updated.item.id).with_edge_type(SIMILAR_TO_EDGE));
    assert_eq!(similarity_neighbors.len(), 1);
    assert_eq!(similarity_neighbors[0].node_id, new_neighbor.item.id);
    assert!(cp
        .store()
        .neighbors(NeighborQuery::in_(&updated.item.id).with_edge_type(SIMILAR_TO_EDGE))
        .is_empty());

    let entity_neighbors = cp
        .store()
        .neighbors(NeighborQuery::out(&updated.item.id).with_edge_type(MENTIONS_ENTITY_EDGE));
    assert_eq!(entity_neighbors.len(), 1);
    assert_eq!(entity_neighbors[0].node_id, "entity:globex-llc");

    let snapshot = cp.store().graph_snapshot().unwrap();
    for edge_id in [
        old_similarity_edge_id,
        incoming_old_similarity_edge_id,
        old_entity_edge_id,
    ] {
        let edge = snapshot
            .edges
            .iter()
            .find(|edge| edge.id == edge_id)
            .expect("reconciled edge remains in graph history");
        assert!(edge.tombstone, "{edge_id} must be tombstoned");
    }
    let active_similarity_edge_id = format!("similar:{}:{}", updated.item.id, new_neighbor.item.id);
    let active_similarity = snapshot
        .edges
        .iter()
        .find(|edge| edge.id == active_similarity_edge_id)
        .expect("replacement similarity edge");
    assert!(!active_similarity.tombstone);
}
