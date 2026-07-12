use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ExplicitEdgeClass {
    Epistemic,
    Reference,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ExplicitEdge {
    pub edge_id: String,
    pub from_id: String,
    pub to_id: String,
    pub edge_type: String,
    pub class: ExplicitEdgeClass,
    pub callout: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct StampSnapshot {
    pub schema_version: u32,
    pub note_id: String,
    pub saved_at_ms: i64,
    pub edges: Vec<ExplicitEdge>,
    pub snapshot_digest: String,
    pub empty_mark: bool,
}

pub fn build_stamp_snapshot(
    note_id: impl Into<String>,
    saved_at_ms: i64,
    mut edges: Vec<ExplicitEdge>,
) -> StampSnapshot {
    let note_id = note_id.into();
    edges.sort_by(|left, right| left.edge_id.cmp(&right.edge_id));
    edges.dedup_by(|left, right| left.edge_id == right.edge_id);
    let bytes = serde_json::to_vec(&(1_u32, &note_id, saved_at_ms, &edges))
        .expect("Growth Stamp values serialize");
    let snapshot_digest = blake3::hash(&bytes).to_hex().to_string();

    StampSnapshot {
        schema_version: 1,
        note_id,
        saved_at_ms,
        empty_mark: edges.is_empty(),
        edges,
        snapshot_digest,
    }
}
