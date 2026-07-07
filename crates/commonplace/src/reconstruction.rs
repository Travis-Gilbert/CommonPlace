//! Reconstruction substrate wiring for CommonPlace.
//!
//! Converts [`ReconstructedFact`] values from the Theorem reconstruction substrate
//! into CommonPlace [`Item`]s and [`Collection`]s so they render natively in the
//! consumer surface without a separate viewer.

use crate::collection::{Collection, CollectionKind};
use crate::item::{Item, ItemKind};
use rustyred_thg_reconstruct_fact::{Modality, ProvenanceChain, ReconstructedFact};
use serde_json::{Map, Value};

/// Convert a single reconstructed fact into a CommonPlace Item.
///
/// The item carries the fact type as its title, the payload as inline body text,
/// and tags/key-value metadata so the substrate's existing PPR/HNSW/community
/// machinery sees it as a first-class graph citizen.
pub fn fact_to_item(fact: &ReconstructedFact) -> Item {
    let body_text = serde_json::to_string_pretty(&fact.payload).unwrap_or_default();

    let mut extra: Map<String, Value> = Map::new();
    extra.insert(
        "reconstruct_modality".into(),
        Value::String(fact.modality.as_str().to_string()),
    );
    extra.insert(
        "reconstruct_fact_type".into(),
        Value::String(fact.fact_type.clone()),
    );
    extra.insert(
        "confidence_mean".into(),
        Value::Number(
            serde_json::Number::from_f64(fact.confidence.mean())
                .unwrap_or(serde_json::Number::from(0)),
        ),
    );
    extra.insert(
        "verification_count".into(),
        Value::Number(fact.confidence.verification_count.into()),
    );
    extra.insert(
        "evidence_kind".into(),
        Value::String(fact.evidence.kind_str().to_string()),
    );

    // Encode provenance as readable structured extra fields.
    provenance_into_extra(&fact.provenance, &mut extra);

    Item::new(
        ItemKind::Other("reconstructed_fact".into()),
        fact.fact_type.clone(),
    )
    .with_text(body_text)
    .with_source(fact.provenance.source_id.clone())
    .with_tags([
        "reconstructed",
        fact.modality.as_str(),
        fact.evidence.kind_str(),
    ])
    .with_classification(fact.modality.as_str())
    .with_extra_map(extra)
}

/// Flatten provenance chain fields into the extra map.
fn provenance_into_extra(provenance: &ProvenanceChain, extra: &mut Map<String, Value>) {
    extra.insert(
        "provenance_source_id".into(),
        Value::String(provenance.source_id.clone()),
    );
    if !provenance.derivation_steps.is_empty() {
        let steps: Vec<Value> = provenance
            .derivation_steps
            .iter()
            .map(|s| Value::String(s.clone()))
            .collect();
        extra.insert("provenance_derivation_steps".into(), Value::Array(steps));
    }
    if let Some(ref hash) = provenance.content_hash {
        extra.insert(
            "provenance_content_hash".into(),
            Value::String(hash.clone()),
        );
    }
}

/// Batch-convert reconstructed facts into items and auto-collections.
///
/// Returns a tuple of `(items, collections)`. Facts are sorted by modality;
/// one [`Collection`] per modality is created so the user can browse binary,
/// data, design, and procedural facts separately.
pub fn facts_to_items_and_collections(facts: &[ReconstructedFact]) -> (Vec<Item>, Vec<Collection>) {
    let items: Vec<Item> = facts.iter().map(fact_to_item).collect();

    // One auto-collection per distinct modality discovered in the batch.
    let mut seen = std::collections::BTreeSet::new();
    let mut collections: Vec<Collection> = Vec::new();
    for fact in facts {
        let modality_str = fact.modality.as_str();
        if seen.insert(modality_str.to_string()) {
            let name = format!("Reconstructed — {}", modality_label(fact.modality));
            let col = Collection::new(name, CollectionKind::Auto)
                .with_description(format!(
                    "Auto-collection of {} reconstructed facts from the {} modality.",
                    modality_label(fact.modality),
                    modality_str,
                ));
            collections.push(col);
        }
    }

    (items, collections)
}

fn modality_label(modality: Modality) -> &'static str {
    match modality {
        Modality::Binary => "Binary",
        Modality::Data => "Data",
        Modality::Design => "Design",
        Modality::Procedural => "Procedural",
    }
}

/// Extension trait to add `with_extra_map` to Item without modifying the
/// upstream crate.
trait ItemExt {
    fn with_extra_map(self, extra: Map<String, Value>) -> Self;
}

impl ItemExt for Item {
    fn with_extra_map(mut self, extra: Map<String, Value>) -> Self {
        for (k, v) in extra {
            self.extra.insert(k, v);
        }
        self
    }
}

#[cfg(test)]
mod reconstruction_tests {
    use super::*;
    use rustyred_thg_reconstruct_fact::{FactConfidence, FactEvidence};

    fn make_test_fact(
        modality: Modality,
        fact_type: &str,
        payload: Value,
        evidence: FactEvidence,
        source_id: &str,
    ) -> ReconstructedFact {
        ReconstructedFact {
            modality,
            fact_type: fact_type.into(),
            payload,
            evidence,
            confidence: FactConfidence::new_prior(modality),
            provenance: ProvenanceChain {
                source_id: source_id.into(),
                derivation_steps: vec!["parse_elf".into(), "semantic_lift".into()],
                content_hash: Some("abc123".into()),
            },
        }
    }

    #[test]
    fn binary_fact_becomes_item() {
        let fact = make_test_fact(
            Modality::Binary,
            "FunctionSemanticSignature",
            serde_json::json!({"name": "main", "arg_count": 2}),
            FactEvidence::Oracle {
                oracle_id: "ghidra".into(),
                oracle_version: Some("11.0".into()),
            },
            "elf:deadbeef",
        );

        let item = fact_to_item(&fact);

        assert_eq!(item.kind, ItemKind::Other("reconstructed_fact".into()));
        assert_eq!(item.title, "FunctionSemanticSignature");
        assert!(item.tags.contains(&"reconstructed".to_string()));
        assert!(item.tags.contains(&"binary".to_string()));
        assert!(item.tags.contains(&"oracle".to_string()));
        assert_eq!(item.classification, Some("binary".into()));
        assert_eq!(item.source, Some("elf:deadbeef".into()));
        assert_eq!(
            item.extra.get("confidence_mean").and_then(|v| v.as_f64()),
            Some(fact.confidence.mean())
        );
        assert_eq!(
            item.extra.get("provenance_content_hash")
                .and_then(|v| v.as_str()),
            Some("abc123")
        );
    }

    #[test]
    fn design_fact_becomes_item_with_weak_confidence() {
        let fact = make_test_fact(
            Modality::Design,
            "SpacingViolation",
            serde_json::json!({"gap_px": 2, "min_required_px": 8}),
            FactEvidence::Heuristic {
                method: "design-check".into(),
            },
            "design:page_home",
        );

        let item = fact_to_item(&fact);
        assert!(item.tags.contains(&"design".to_string()));
        assert!(item.tags.contains(&"heuristic".to_string()));
        // Design prior: Beta(1, 2) → mean < 0.5
        let cm = item
            .extra
            .get("confidence_mean")
            .and_then(|v| v.as_f64())
            .unwrap();
        assert!(cm < 0.5);
    }

    #[test]
    fn inference_evidence_kind_tagged() {
        let fact = make_test_fact(
            Modality::Data,
            "FieldFact",
            serde_json::json!({"field": "email", "type": "string"}),
            FactEvidence::Inference {
                rule: "type_inference".into(),
                premises: vec!["field_name: email".into()],
            },
            "data:record_1",
        );
        let item = fact_to_item(&fact);
        assert!(item.tags.contains(&"inference".to_string()));
    }

    #[test]
    fn facts_to_collections_groups_by_modality() {
        let facts = vec![
            make_test_fact(
                Modality::Binary,
                "FuncA",
                serde_json::json!({}),
                FactEvidence::Oracle {
                    oracle_id: "g".into(),
                    oracle_version: None,
                },
                "s1",
            ),
            make_test_fact(
                Modality::Binary,
                "FuncB",
                serde_json::json!({}),
                FactEvidence::Oracle {
                    oracle_id: "g".into(),
                    oracle_version: None,
                },
                "s2",
            ),
            make_test_fact(
                Modality::Design,
                "DesignX",
                serde_json::json!({}),
                FactEvidence::Heuristic {
                    method: "dc".into(),
                },
                "s3",
            ),
        ];

        let (items, collections) = facts_to_items_and_collections(&facts);
        assert_eq!(items.len(), 3);
        // Two modalities → two auto-collections.
        assert_eq!(collections.len(), 2);
        let col_names: Vec<&str> = collections.iter().map(|c| c.name.as_str()).collect();
        assert!(col_names.contains(&"Reconstructed — Binary"));
        assert!(col_names.contains(&"Reconstructed — Design"));
        for col in &collections {
            assert_eq!(col.kind, CollectionKind::Auto);
        }
    }

    #[test]
    fn empty_facts_gives_empty_results() {
        let (items, collections) = facts_to_items_and_collections(&[]);
        assert!(items.is_empty());
        assert!(collections.is_empty());
    }
}
