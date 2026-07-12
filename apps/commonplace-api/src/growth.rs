use std::time::Duration;

use async_graphql::SimpleObject;
use serde::de::Deserializer;
use serde::Deserialize;

const GROWTH_SNAPSHOT_SCHEMA_VERSION: i32 = 1;
const GROWTH_SNAPSHOT_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthContextLevelGql {
    pub leaf: String,
    pub level: i32,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthSkillGql {
    pub name: String,
    pub unlocked_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthBadgeGql {
    pub name: String,
    pub awarded_at: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthDisplayedStatsGql {
    pub form: String,
    pub evolution_stage: i32,
    pub context_levels: Vec<GrowthContextLevelGql>,
    pub nature_bucket: String,
    pub skills: Vec<GrowthSkillGql>,
    pub calibration_grade: String,
    pub lineage_depth: i64,
    pub episode_count: i64,
    pub badges: Vec<GrowthBadgeGql>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthCardManifestGql {
    pub owner_public_fingerprint: String,
    pub genesis_digest: String,
    pub epoch_number: i64,
    pub epoch_date: String,
    pub initial_commit: String,
    pub initial_message: String,
    pub lineage_head: String,
    pub displayed_stats: GrowthDisplayedStatsGql,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthCardBundleGql {
    pub manifest: GrowthCardManifestGql,
    pub face_svg: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthCardGql {
    pub bundle: GrowthCardBundleGql,
    pub stats: GrowthDisplayedStatsGql,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthContextXpGql {
    pub leaf: String,
    pub xp: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthXpGql {
    pub total: i64,
    #[serde(deserialize_with = "deserialize_context_xp")]
    pub by_context: Vec<GrowthContextXpGql>,
    pub session_delta: i64,
}

fn deserialize_context_xp<'de, D>(deserializer: D) -> Result<Vec<GrowthContextXpGql>, D::Error>
where
    D: Deserializer<'de>,
{
    let entries = Vec::<(String, i64)>::deserialize(deserializer)?;
    Ok(entries
        .into_iter()
        .map(|(leaf, xp)| GrowthContextXpGql { leaf, xp })
        .collect())
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthReadinessGql {
    pub leaf: String,
    pub level_current: i32,
    pub ready: bool,
    pub ci_width: f64,
    pub shrinkage_since_level: f64,
    pub evidence_n: i64,
    pub failing_predicates: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthTimelinePointGql {
    pub commit_hash: String,
    pub parent_commits: Vec<String>,
    pub observed_at_ms: i64,
    pub xp: i64,
    pub context_levels: Vec<GrowthContextLevelGql>,
    pub stats: GrowthDisplayedStatsGql,
    pub form_svg: String,
    pub beats: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthGraphNodeGql {
    pub id: String,
    pub leaf: String,
    pub label: String,
    pub posterior_mass: f64,
    pub uncertainty_width: f64,
    pub level: i32,
    pub ready: bool,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthGraphEdgeGql {
    pub source: String,
    pub target: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthStampEdgeGql {
    pub edge_id: String,
    pub from_id: String,
    pub to_id: String,
    pub edge_type: String,
    pub class: String,
    pub callout: String,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthStampGql {
    pub note_id: String,
    pub saved_at_ms: i64,
    pub snapshot_digest: String,
    pub empty_mark: bool,
    pub edges: Vec<GrowthStampEdgeGql>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthPublicLineageGql {
    pub domain_families: Option<Vec<String>>,
    pub most_exercised_skills: Option<Vec<String>>,
    pub dominant_languages: Option<Vec<String>>,
    pub world_families: Option<Vec<String>>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthListingGql {
    pub listing_id: String,
    pub card: GrowthCardBundleGql,
    pub lineage: GrowthPublicLineageGql,
    pub public_timeline: Vec<GrowthTimelinePointGql>,
    pub published_at_ms: i64,
}

#[derive(Clone, Debug, Deserialize, PartialEq, SimpleObject)]
pub struct GrowthSnapshotGql {
    pub schema_version: i32,
    pub generated_at_ms: i64,
    pub source: String,
    pub tenant_slug: String,
    pub xp: GrowthXpGql,
    pub readiness: Vec<GrowthReadinessGql>,
    pub card: GrowthCardGql,
    pub timeline: Vec<GrowthTimelinePointGql>,
    pub graph_nodes: Vec<GrowthGraphNodeGql>,
    pub graph_edges: Vec<GrowthGraphEdgeGql>,
    pub stamps: Vec<GrowthStampGql>,
    pub listings: Vec<GrowthListingGql>,
}

impl GrowthSnapshotGql {
    fn validate(&self) -> Result<(), String> {
        if self.schema_version != GROWTH_SNAPSHOT_SCHEMA_VERSION {
            return Err(format!(
                "unsupported Growth snapshot schema {}",
                self.schema_version
            ));
        }
        if self.source != "live" {
            return Err("CommonPlace accepts live Growth snapshots only".to_string());
        }
        if self.tenant_slug.trim().is_empty() {
            return Err("Growth snapshot tenant is empty".to_string());
        }
        if self.card.stats != self.card.bundle.manifest.displayed_stats {
            return Err("Growth card stats disagree with the signed manifest".to_string());
        }
        for node in &self.graph_nodes {
            let Some(readiness) = self
                .readiness
                .iter()
                .find(|report| report.leaf == node.leaf)
            else {
                return Err(format!(
                    "Growth graph node {} has no readiness report",
                    node.id
                ));
            };
            if readiness.ready != node.ready || readiness.ci_width != node.uncertainty_width {
                return Err(format!(
                    "Growth graph node {} disagrees with readiness",
                    node.id
                ));
            }
        }
        Ok(())
    }
}

#[derive(Clone, Debug, SimpleObject)]
pub struct GrowthSnapshotResultGql {
    pub available: bool,
    pub message: Option<String>,
    pub snapshot: Option<GrowthSnapshotGql>,
}

impl GrowthSnapshotResultGql {
    fn unavailable(message: impl Into<String>) -> Self {
        Self {
            available: false,
            message: Some(message.into()),
            snapshot: None,
        }
    }

    fn ready(snapshot: GrowthSnapshotGql) -> Self {
        Self {
            available: true,
            message: None,
            snapshot: Some(snapshot),
        }
    }
}

pub async fn load_growth_snapshot_from_env() -> GrowthSnapshotResultGql {
    match load_growth_snapshot().await {
        Ok(Some(snapshot)) => GrowthSnapshotResultGql::ready(snapshot),
        Ok(None) => GrowthSnapshotResultGql::unavailable(
            "No live Growth snapshot is configured. Set THEOREM_GROWTH_SNAPSHOT_URL or THEOREM_GROWTH_SNAPSHOT_PATH.",
        ),
        Err(error) => GrowthSnapshotResultGql::unavailable(error),
    }
}

async fn load_growth_snapshot() -> Result<Option<GrowthSnapshotGql>, String> {
    if let Some(url) = nonempty_env("THEOREM_GROWTH_SNAPSHOT_URL") {
        let client = reqwest::Client::builder()
            .timeout(GROWTH_SNAPSHOT_TIMEOUT)
            .build()
            .map_err(|error| format!("could not build Growth snapshot client: {error}"))?;
        let response = client
            .get(url)
            .header(reqwest::header::ACCEPT, "application/json")
            .send()
            .await
            .map_err(|error| format!("Growth snapshot request failed: {error}"))?;
        if !response.status().is_success() {
            return Err(format!(
                "Growth snapshot upstream returned {}",
                response.status()
            ));
        }
        let bytes = response
            .bytes()
            .await
            .map_err(|error| format!("Growth snapshot body failed: {error}"))?;
        return parse_growth_snapshot(&bytes).map(Some);
    }

    if let Some(path) = nonempty_env("THEOREM_GROWTH_SNAPSHOT_PATH") {
        let bytes = tokio::fs::read(path)
            .await
            .map_err(|error| format!("could not read Growth snapshot: {error}"))?;
        return parse_growth_snapshot(&bytes).map(Some);
    }

    Ok(None)
}

fn nonempty_env(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn parse_growth_snapshot(bytes: &[u8]) -> Result<GrowthSnapshotGql, String> {
    let snapshot: GrowthSnapshotGql = serde_json::from_slice(bytes)
        .map_err(|error| format!("invalid Growth snapshot: {error}"))?;
    snapshot.validate()?;
    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::parse_growth_snapshot;

    fn stats() -> serde_json::Value {
        json!({
            "form": "Lantern Stag",
            "evolution_stage": 2,
            "context_levels": [{ "leaf": "rust/refactor", "level": 7 }],
            "nature_bucket": "Deliberate",
            "skills": [{ "name": "Dependency untangling", "unlocked_at": "2026-07-08" }],
            "calibration_grade": "A-",
            "lineage_depth": 18,
            "episode_count": 142,
            "badges": []
        })
    }

    fn snapshot(source: &str) -> Vec<u8> {
        serde_json::to_vec(&json!({
            "schema_version": 1,
            "generated_at_ms": 1,
            "source": source,
            "tenant_slug": "Travis-Gilbert",
            "xp": { "total": 18420, "by_context": [["rust/refactor", 18420]], "session_delta": 340 },
            "readiness": [{
                "leaf": "rust/refactor", "level_current": 7, "ready": true,
                "ci_width": 0.1, "shrinkage_since_level": 0.04, "evidence_n": 142,
                "failing_predicates": []
            }],
            "card": {
                "bundle": {
                    "manifest": {
                        "owner_public_fingerprint": "key:123", "genesis_digest": "genesis",
                        "epoch_number": 2, "epoch_date": "2026-07-01", "initial_commit": "initial",
                        "initial_message": "Born curious.", "lineage_head": "head",
                        "displayed_stats": stats()
                    },
                    "face_svg": "<svg></svg>"
                },
                "stats": stats()
            },
            "timeline": [],
            "graph_nodes": [{
                "id": "rust", "leaf": "rust/refactor", "label": "Rust refactor",
                "posterior_mass": 142.0, "uncertainty_width": 0.1, "level": 7, "ready": true
            }],
            "graph_edges": [], "stamps": [], "listings": []
        }))
        .unwrap()
    }

    #[test]
    fn accepts_a_consistent_live_snapshot() {
        let parsed = parse_growth_snapshot(&snapshot("live")).expect("live snapshot parses");
        assert_eq!(parsed.xp.total, 18420);
        assert_eq!(parsed.card.stats.form, "Lantern Stag");
    }

    #[test]
    fn rejects_fixture_snapshots_on_the_product_edge() {
        let error = parse_growth_snapshot(&snapshot("fixture")).unwrap_err();
        assert!(error.contains("live Growth snapshots only"));
    }
}
