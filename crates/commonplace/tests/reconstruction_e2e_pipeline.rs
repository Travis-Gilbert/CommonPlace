//! E2E pipeline acceptance: binary reconstructor → ReconstructedFact → graph store → read-back.
//!
//! Plan acceptance (North Star Reconstruction Substrate, Phase 4):
//! "binary reconstructor → ReconstructedFact → graph store → CommonPlace renders"
//!
//! Verified against the in-memory engine (fast, repeatable). The full end-to-end
//! with the running RustyRed node is exercised separately via the Harness
//! GraphQL query path; this test proves the data-plane pipeline from reconstructor
//! output through CommonPlace store write and read-back.

use commonplace::{
    fact_to_item, facts_to_items_and_collections, CollectionKind, Commonplace, InMemoryBlobStore,
    Item, ItemBody, ItemKind,
};
use rustyred_thg_core::InMemoryGraphStore;
use rustyred_thg_reconstruct_fact::{
    FactConfidence, FactEvidence, Modality, ProvenanceChain, ReconstructedFact,
};
use serde_json::json;

fn fresh() -> Commonplace<InMemoryGraphStore, InMemoryBlobStore> {
    Commonplace::new(InMemoryGraphStore::new(), InMemoryBlobStore::new())
}

fn make_binary_fact(name: &str, arg_count: u32, source_id: &str) -> ReconstructedFact {
    ReconstructedFact {
        modality: Modality::Binary,
        fact_type: "FunctionSemanticSignature".into(),
        payload: json!({"name": name, "arg_count": arg_count}),
        evidence: FactEvidence::Oracle {
            oracle_id: "ghidra".into(),
            oracle_version: Some("11.0".into()),
        },
        confidence: FactConfidence::new_prior(Modality::Binary),
        provenance: ProvenanceChain {
            source_id: source_id.into(),
            derivation_steps: vec!["parse_elf".into(), "semantic_lift".into()],
            content_hash: Some("abc123def456".into()),
        },
    }
}

/// Helper: verify an Item carries all the reconstruction markers we expect.
fn assert_item_is_reconstructed(item: &Item, expected_title: &str, expected_modality: &str) {
    assert_eq!(item.kind, ItemKind::Other("reconstructed_fact".into()));
    assert_eq!(item.title, expected_title);
    assert!(item.tags.contains(&"reconstructed".to_string()));
    assert!(item.tags.contains(&expected_modality.to_string()));
    assert_eq!(item.classification.as_deref(), Some(expected_modality));
}

// --- Single-fact roundtrip ---

#[test]
fn binary_fact_writes_and_reads_back_through_commonplace_store() {
    let mut cp = fresh();
    let fact = make_binary_fact("main", 2, "elf:deadbeef");

    let item = fact_to_item(&fact);
    let stored = cp.put_item(item).unwrap();

    assert!(!stored.id.is_empty(), "store assigns id");
    assert!(stored.created_at_ms > 0);
    assert!(stored.updated_at_ms > 0);

    let got = cp.get_item(&stored.id).unwrap().expect("item reads back");
    assert_item_is_reconstructed(&got, "FunctionSemanticSignature", "binary");

    // Verify the extra fields survive the store roundtrip
    assert_eq!(
        got.extra
            .get("reconstruct_modality")
            .and_then(|v| v.as_str()),
        Some("binary")
    );
    assert_eq!(
        got.extra
            .get("reconstruct_fact_type")
            .and_then(|v| v.as_str()),
        Some("FunctionSemanticSignature")
    );
    assert_eq!(
        got.extra.get("evidence_kind").and_then(|v| v.as_str()),
        Some("oracle")
    );
    assert_eq!(got.source.as_deref(), Some("elf:deadbeef"));
    assert_eq!(
        got.extra
            .get("provenance_source_id")
            .and_then(|v| v.as_str()),
        Some("elf:deadbeef")
    );
    assert_eq!(
        got.extra
            .get("provenance_content_hash")
            .and_then(|v| v.as_str()),
        Some("abc123def456")
    );

    // Payload survives as inline body
    match &got.body {
        ItemBody::Inline { text } => {
            assert!(text.contains("main"));
            assert!(text.contains("arg_count"));
        }
        other => panic!("expected inline body, got {other:?}"),
    }
}

// --- Four-modality roundtrip ---

fn make_data_fact(source_id: &str) -> ReconstructedFact {
    ReconstructedFact {
        modality: Modality::Data,
        fact_type: "FieldFact".into(),
        payload: json!({"field": "email", "type": "string", "nullable": false}),
        evidence: FactEvidence::Inference {
            rule: "type_inference".into(),
            premises: vec!["field_name: email".into()],
        },
        confidence: FactConfidence::new_prior(Modality::Data),
        provenance: ProvenanceChain {
            source_id: source_id.into(),
            derivation_steps: vec![],
            content_hash: None,
        },
    }
}

fn make_design_fact(source_id: &str) -> ReconstructedFact {
    ReconstructedFact {
        modality: Modality::Design,
        fact_type: "SpacingViolation".into(),
        payload: json!({"gap_px": 2, "min_required_px": 8}),
        evidence: FactEvidence::Heuristic {
            method: "design-check".into(),
        },
        confidence: FactConfidence::new_prior(Modality::Design),
        provenance: ProvenanceChain {
            source_id: source_id.into(),
            derivation_steps: vec![],
            content_hash: None,
        },
    }
}

fn make_procedural_fact(source_id: &str) -> ReconstructedFact {
    ReconstructedFact {
        modality: Modality::Procedural,
        fact_type: "WorldScene".into(),
        payload: json!({"scene": "terrain_procgen", "seed": 42}),
        evidence: FactEvidence::Inference {
            rule: "worldgen_pass".into(),
            premises: vec!["seed:42".into()],
        },
        confidence: FactConfidence::new_prior(Modality::Procedural),
        provenance: ProvenanceChain {
            source_id: source_id.into(),
            derivation_steps: vec!["procgen".into(), "bake".into()],
            content_hash: Some("gltf_hash_xyz".into()),
        },
    }
}

#[test]
fn all_four_modalities_roundtrip_through_commonplace_store() {
    let mut cp = fresh();

    let facts = [
        make_binary_fact("main", 2, "s1"),
        make_data_fact("s2"),
        make_design_fact("s3"),
        make_procedural_fact("s4"),
    ];

    let items: Vec<Item> = facts.iter().map(fact_to_item).collect();
    assert_eq!(items.len(), 4);

    let mut ids = Vec::new();
    for item in items {
        let stored = cp.put_item(item).unwrap();
        ids.push(stored.id);
    }

    // Read back each and verify modality-specific markers
    let binary = cp.get_item(&ids[0]).unwrap().unwrap();
    assert_item_is_reconstructed(&binary, "FunctionSemanticSignature", "binary");
    assert!(binary.tags.contains(&"oracle".to_string()));

    let data = cp.get_item(&ids[1]).unwrap().unwrap();
    assert_item_is_reconstructed(&data, "FieldFact", "data");
    assert!(data.tags.contains(&"inference".to_string()));

    let design = cp.get_item(&ids[2]).unwrap().unwrap();
    assert_item_is_reconstructed(&design, "SpacingViolation", "design");
    assert!(design.tags.contains(&"heuristic".to_string()));

    let procedural = cp.get_item(&ids[3]).unwrap().unwrap();
    assert_item_is_reconstructed(&procedural, "WorldScene", "procedural");
    // Procedural fact can carry glTF metadata for the Scene/R3F surface
    assert_eq!(
        procedural
            .extra
            .get("provenance_content_hash")
            .and_then(|v| v.as_str()),
        Some("gltf_hash_xyz")
    );
}

// --- Batch facts → items + collections ---

#[test]
fn batch_facts_produce_items_and_auto_collections() {
    let mut cp = fresh();

    let facts = vec![
        make_binary_fact("f1", 0, "s1"),
        make_binary_fact("f2", 1, "s2"),
        make_design_fact("s3"),
    ];

    let (items, collections) = facts_to_items_and_collections(&facts);
    assert_eq!(items.len(), 3);
    // Two modalities → two auto-collections
    assert_eq!(collections.len(), 2);

    // Write everything
    for item in &items {
        cp.put_item(item.clone()).unwrap();
    }
    for col in &collections {
        let stored = cp
            .create_collection(&col.name, CollectionKind::Auto)
            .unwrap();
        assert_eq!(stored.name, col.name);
        assert_eq!(stored.kind, CollectionKind::Auto);
    }

    let col_names: Vec<&str> = collections.iter().map(|c| c.name.as_str()).collect();
    assert!(col_names.contains(&"Reconstructed — Binary"));
    assert!(col_names.contains(&"Reconstructed — Design"));
}

// --- Confidence survives the store roundtrip ---

#[test]
fn confidence_fields_survive_store_roundtrip() {
    let mut cp = fresh();
    let fact = make_binary_fact("main", 0, "s1");

    let item = fact_to_item(&fact);
    let confidence_mean_before = fact.confidence.mean();
    let stored = cp.put_item(item.clone()).unwrap();
    let got = cp.get_item(&stored.id).unwrap().unwrap();

    let cm = got
        .extra
        .get("confidence_mean")
        .and_then(|v| v.as_f64())
        .unwrap();
    assert!((cm - confidence_mean_before).abs() < 1e-9);

    let vc = got
        .extra
        .get("verification_count")
        .and_then(|v| v.as_u64())
        .unwrap();
    // Prior has 0 verifications
    assert_eq!(vc, 0);
}

// --- Empty batch edge case ---

#[test]
fn empty_facts_batch() {
    let (items, collections) = facts_to_items_and_collections(&[]);
    assert!(items.is_empty());
    assert!(collections.is_empty());
}

// --- glTF URL propagation for Scene/R3F surface ---
// When a procedural fact carries scene artifact metadata, it should survive the
// Item roundtrip so the TypeScript layer can resolve the glTF URL for the
// Model3dRenderer component.

#[test]
fn procedural_fact_carries_gltf_metadata_for_scene_surface() {
    let mut cp = fresh();
    let mut fact = make_procedural_fact("s:scene1");
    // Simulate reconstructor stamping a glTF URL into extra metadata
    // (in real flow this would come from the reconstruction engine output).
    fact.provenance.content_hash = Some("gltf://scenes/terrain_procgen/model.glb".into());

    let item = fact_to_item(&fact);
    let stored = cp.put_item(item).unwrap();
    let got = cp.get_item(&stored.id).unwrap().unwrap();

    // The provenance hash survives → TypeScript resolveGltfUrl() picks it up
    assert_eq!(
        got.extra
            .get("provenance_content_hash")
            .and_then(|v| v.as_str()),
        Some("gltf://scenes/terrain_procgen/model.glb")
    );

    // Classification carries the modality so the scene package builder knows it's procedural
    assert_eq!(got.classification.as_deref(), Some("procedural"));
    // The title doubles as the display label in Model3dRenderer
    assert_eq!(got.title, "WorldScene");
}

// --- PPR/HNSW discoverability — reconstructed facts are graph-native citizens ---

#[test]
fn reconstructed_fact_is_discoverable_through_items_by_kind() {
    let mut cp = fresh();

    let fact = make_binary_fact("init", 0, "s:init");
    let item = fact_to_item(&fact);
    let stored = cp.put_item(item).unwrap();

    // Query by Item kind — the store's label index should find it
    let reconstructed = cp
        .items_by_kind(&ItemKind::Other("reconstructed_fact".into()))
        .unwrap();
    assert!(reconstructed.iter().any(|n| n.id == stored.id));

    // All items should also contain it
    let all_items = cp.all_items().unwrap();
    assert!(all_items.iter().any(|n| n.id == stored.id));
}

// --- Source-tagged facts are traceable ---

#[test]
fn reconstructed_facts_traceable_by_source_and_modality() {
    let mut cp = fresh();
    let fact = make_binary_fact("trace_me", 3, "elf:unique_source");
    let item = fact_to_item(&fact);
    let stored = cp.put_item(item).unwrap();
    let got = cp.get_item(&stored.id).unwrap().unwrap();

    assert_eq!(got.source.as_deref(), Some("elf:unique_source"));
    assert_eq!(got.classification.as_deref(), Some("binary"));
    assert_eq!(
        got.extra
            .get("provenance_source_id")
            .and_then(|v| v.as_str()),
        Some("elf:unique_source")
    );

    // The tag is attached two ways: inline on Item.tags and as graph-edge HAS_TAG.
    let t = cp.tag_item(&stored.id, "oracle").unwrap();
    assert_eq!(t.name, "oracle");
    let back_tags = cp.item_tags(&stored.id).unwrap();
    assert!(back_tags.iter().any(|t| t.name == "reconstructed"));
    assert!(back_tags.iter().any(|t| t.name == "oracle"));
}

// --- query_by_label / query_by_property — direct graph queries ---

#[test]
fn query_by_label_returns_nodes_with_matching_label() {
    let mut cp = fresh();
    let fact = make_binary_fact("query_me", 1, "s:ql");
    cp.put_item(fact_to_item(&fact)).unwrap();

    // The store uses "Item" as its node label; query_by_label should find it.
    let nodes = cp.query_by_label("Item").unwrap();
    assert_eq!(nodes.len(), 1);
    // Title is always the fact_type, not the payload name
    assert_eq!(
        nodes[0]
            .properties
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap(),
        "FunctionSemanticSignature"
    );
}

#[test]
fn query_by_label_returns_empty_for_unknown_label() {
    let cp = fresh();
    let nodes = cp.query_by_label("NonExistentLabel").unwrap();
    assert!(nodes.is_empty());
}

#[test]
fn query_by_property_exact_match_finds_node() {
    let mut cp = fresh();
    let fact = make_binary_fact("exact_match", 2, "s:em");
    cp.put_item(fact_to_item(&fact)).unwrap();

    let nodes = cp
        .query_by_property("Item", "kind", &json!("reconstructed_fact"))
        .unwrap();
    assert!(!nodes.is_empty());
    assert_eq!(
        nodes[0]
            .properties
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap(),
        "FunctionSemanticSignature"
    );
}

#[test]
fn query_by_property_no_match_returns_empty() {
    let mut cp = fresh();
    let fact = make_binary_fact("no_match", 0, "s:nm");
    cp.put_item(fact_to_item(&fact)).unwrap();

    let nodes = cp
        .query_by_property("Item", "kind", &json!("nonexistent_kind"))
        .unwrap();
    assert!(nodes.is_empty());
}
