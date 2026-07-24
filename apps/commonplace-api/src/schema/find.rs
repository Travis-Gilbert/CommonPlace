//! GraphQL projection of the composed find (SPEC-COMMONPLACE-SEARCH-STACK B3,
//! surfaced by B7).
//!
//! These types are a thin wire skin over `rustyred_thg_find`. They exist so the
//! Rust shapes stay snake_case internally while the wire stays camelCase, and
//! so the same executor can serve this door and the MCP door in B8 without
//! either one owning the vocabulary. Field names match the pinned TypeScript
//! contract at `packages/block-view-contracts/src/search-stack.ts`.

use async_graphql::{Enum, InputObject, SimpleObject};
use rustyred_thg_find::{
    EdgeRef, FindHit, FindRequest, FindResponse, FindResult, FindScope, GraphRelation, Lane,
    LaneBudget,
};

/// Which match lane produced a hit.
#[derive(Copy, Clone, Debug, Enum, Eq, PartialEq)]
#[graphql(name = "FindLane")]
pub enum FindLaneGql {
    Exact,
    Lexical,
    Semantic,
    Structural,
}

impl From<Lane> for FindLaneGql {
    fn from(lane: Lane) -> Self {
        match lane {
            Lane::Exact => Self::Exact,
            Lane::Lexical => Self::Lexical,
            Lane::Semantic => Self::Semantic,
            Lane::Structural => Self::Structural,
        }
    }
}

impl From<FindLaneGql> for Lane {
    fn from(lane: FindLaneGql) -> Self {
        match lane {
            FindLaneGql::Exact => Self::Exact,
            FindLaneGql::Lexical => Self::Lexical,
            FindLaneGql::Semantic => Self::Semantic,
            FindLaneGql::Structural => Self::Structural,
        }
    }
}

/// Scope kinds, in widening order.
#[derive(Copy, Clone, Debug, Enum, Eq, PartialEq)]
#[graphql(name = "FindScopeKind")]
pub enum FindScopeKindGql {
    Page,
    Session,
    Corpus,
    Web,
}

/// How a result stands against what the person already knows. Annotation, never
/// a filter: `Orphan` is an honest answer and the result is still returned.
#[derive(Copy, Clone, Debug, Enum, Eq, PartialEq)]
#[graphql(name = "GraphRelation")]
pub enum GraphRelationGql {
    Known,
    Extends,
    Contradicts,
    Orphan,
}

impl From<GraphRelation> for GraphRelationGql {
    fn from(relation: GraphRelation) -> Self {
        match relation {
            GraphRelation::Known => Self::Known,
            GraphRelation::Extends => Self::Extends,
            GraphRelation::Contradicts => Self::Contradicts,
            GraphRelation::Orphan => Self::Orphan,
        }
    }
}

/// One scope in the widening ladder. GraphQL inputs have no tagged unions, so
/// the kind selects which of the optional id fields is read.
#[derive(Clone, Debug, InputObject)]
pub struct FindScopeInput {
    pub kind: FindScopeKindGql,
    /// Required when `kind` is `PAGE`.
    pub node_id: Option<String>,
    /// Required when `kind` is `SESSION`.
    pub node_ids: Option<Vec<String>>,
}

impl FindScopeInput {
    pub fn into_scope(self) -> Result<FindScope, String> {
        match self.kind {
            FindScopeKindGql::Page => self
                .node_id
                .filter(|id| !id.trim().is_empty())
                .map(FindScope::Page)
                .ok_or_else(|| "page scope requires nodeId".to_string()),
            FindScopeKindGql::Session => {
                let ids = self.node_ids.unwrap_or_default();
                if ids.is_empty() {
                    Err("session scope requires nodeIds".to_string())
                } else {
                    Ok(FindScope::Session(ids))
                }
            }
            FindScopeKindGql::Corpus => Ok(FindScope::Corpus),
            FindScopeKindGql::Web => Ok(FindScope::Web),
        }
    }
}

/// Byte range inside the document's indexed text property.
#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "ByteRange")]
pub struct ByteRangeGql {
    pub start: i32,
    pub end: i32,
}

#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "FindScopeRef")]
pub struct FindScopeRefGql {
    pub kind: FindScopeKindGql,
    pub node_id: Option<String>,
    pub node_ids: Option<Vec<String>>,
}

impl From<&FindScope> for FindScopeRefGql {
    fn from(scope: &FindScope) -> Self {
        match scope {
            FindScope::Page(id) => Self {
                kind: FindScopeKindGql::Page,
                node_id: Some(id.clone()),
                node_ids: None,
            },
            FindScope::Session(ids) => Self {
                kind: FindScopeKindGql::Session,
                node_id: None,
                node_ids: Some(ids.clone()),
            },
            FindScope::Corpus => Self {
                kind: FindScopeKindGql::Corpus,
                node_id: None,
                node_ids: None,
            },
            FindScope::Web => Self {
                kind: FindScopeKindGql::Web,
                node_id: None,
                node_ids: None,
            },
        }
    }
}

#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "EdgeRef")]
pub struct EdgeRefGql {
    pub id: String,
    pub from_id: String,
    pub to_id: String,
    #[graphql(name = "type")]
    pub edge_type: String,
    pub confidence: Option<f64>,
}

impl From<&EdgeRef> for EdgeRefGql {
    fn from(edge: &EdgeRef) -> Self {
        Self {
            id: edge.id.clone(),
            from_id: edge.from_id.clone(),
            to_id: edge.to_id.clone(),
            edge_type: edge.edge_type.clone(),
            confidence: edge.confidence,
        }
    }
}

#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "FindHit")]
pub struct FindHitGql {
    pub doc: String,
    pub byte_range: ByteRangeGql,
    pub lane: FindLaneGql,
    pub scope: FindScopeRefGql,
    pub snippet: Option<String>,
    pub title: Option<String>,
    pub source: Option<String>,
}

impl From<&FindHit> for FindHitGql {
    fn from(hit: &FindHit) -> Self {
        Self {
            doc: hit.doc.clone(),
            byte_range: ByteRangeGql {
                start: hit.byte_range.start as i32,
                end: hit.byte_range.end as i32,
            },
            lane: hit.lane.into(),
            scope: FindScopeRefGql::from(&hit.scope),
            snippet: hit.snippet.clone(),
            title: hit.title.clone(),
            source: hit.source.clone(),
        }
    }
}

#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "FindResult")]
pub struct FindResultGql {
    pub hit: FindHitGql,
    pub score: f64,
    pub relation: GraphRelationGql,
    pub edges: Vec<EdgeRefGql>,
}

impl From<&FindResult> for FindResultGql {
    fn from(result: &FindResult) -> Self {
        Self {
            hit: FindHitGql::from(&result.hit),
            score: result.score as f64,
            relation: result.relation.into(),
            edges: result.edges.iter().map(EdgeRefGql::from).collect(),
        }
    }
}

/// Per-lane accounting, so a surface can say which lane went quiet and why.
#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "LaneReceipt")]
pub struct LaneReceiptGql {
    pub lane: FindLaneGql,
    pub seeded: i32,
    pub admitted: i32,
    pub degraded_reason: Option<String>,
}

impl From<&LaneBudget> for LaneReceiptGql {
    fn from(budget: &LaneBudget) -> Self {
        Self {
            lane: budget.lane.into(),
            seeded: budget.seeded as i32,
            admitted: budget.admitted as i32,
            degraded_reason: budget.degraded_reason.clone(),
        }
    }
}

#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "FindResponse")]
pub struct FindResponseGql {
    pub query: String,
    pub results: Vec<FindResultGql>,
    pub lanes: Vec<LaneReceiptGql>,
    pub scopes_searched: Vec<String>,
    pub lambda: f64,
    /// Stable identity for the retrieval, for provenance and cache keys.
    pub retrieval_ref: String,
}

impl From<FindResponse> for FindResponseGql {
    fn from(response: FindResponse) -> Self {
        Self {
            query: response.query,
            results: response.results.iter().map(FindResultGql::from).collect(),
            lanes: response.lanes.iter().map(LaneReceiptGql::from).collect(),
            scopes_searched: response.scopes_searched,
            lambda: response.lambda as f64,
            retrieval_ref: response.retrieval_ref,
        }
    }
}

/// Build the executor request from resolver arguments, applying the same
/// clamps the executor would apply anyway so the response reports what was
/// actually run.
pub fn build_request(
    query: String,
    scopes: Option<Vec<FindScopeInput>>,
    lanes: Option<Vec<FindLaneGql>>,
    k: Option<i32>,
    lambda: Option<f64>,
) -> Result<FindRequest, String> {
    let scopes = match scopes {
        Some(scopes) if !scopes.is_empty() => scopes
            .into_iter()
            .map(FindScopeInput::into_scope)
            .collect::<Result<Vec<_>, _>>()?,
        _ => vec![FindScope::Corpus],
    };
    let lanes = match lanes {
        Some(lanes) if !lanes.is_empty() => lanes.into_iter().map(Lane::from).collect(),
        _ => Lane::ALL.to_vec(),
    };
    Ok(FindRequest {
        query,
        scopes,
        lanes,
        k: k.unwrap_or(10).clamp(1, 200) as usize,
        lambda: lambda.unwrap_or(0.7).clamp(0.0, 1.0) as f32,
    })
}

/// Receipt for `saveUrl`. `collectionName` is the real name the ingest pipeline
/// chose; the F4 confirmation renders it verbatim and never a placeholder.
#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "SaveUrlReceipt")]
pub struct SaveUrlReceiptGql {
    pub item_id: String,
    pub collection_id: String,
    pub collection_name: String,
    pub title: String,
    pub url: String,
}

impl From<crate::save_url::SaveUrlReceipt> for SaveUrlReceiptGql {
    fn from(receipt: crate::save_url::SaveUrlReceipt) -> Self {
        Self {
            item_id: receipt.item_id,
            collection_id: receipt.collection_id,
            collection_name: receipt.collection_name,
            title: receipt.title,
            url: receipt.url,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn page_scope_requires_a_node_id() {
        let input = FindScopeInput {
            kind: FindScopeKindGql::Page,
            node_id: None,
            node_ids: None,
        };
        assert!(input.into_scope().is_err());
    }

    #[test]
    fn session_scope_requires_node_ids() {
        let input = FindScopeInput {
            kind: FindScopeKindGql::Session,
            node_id: None,
            node_ids: Some(Vec::new()),
        };
        assert!(input.into_scope().is_err());
    }

    #[test]
    fn scopes_default_to_corpus_and_lanes_to_all() {
        let request = build_request("candidate".into(), None, None, None, None).expect("request");
        assert_eq!(request.scopes, vec![FindScope::Corpus]);
        assert_eq!(request.lanes.len(), 4);
        assert_eq!(request.k, 10);
    }

    #[test]
    fn k_and_lambda_are_clamped_not_trusted() {
        let request =
            build_request("q".into(), None, None, Some(-5), Some(9.0)).expect("request");
        assert_eq!(request.k, 1);
        assert_eq!(request.lambda, 1.0);
        let request = build_request("q".into(), None, None, Some(9_999), Some(-1.0))
            .expect("request");
        assert_eq!(request.k, 200);
        assert_eq!(request.lambda, 0.0);
    }

    #[test]
    fn lane_round_trips_through_the_wire_enum() {
        for lane in Lane::ALL {
            assert_eq!(Lane::from(FindLaneGql::from(lane)), lane);
        }
    }

    #[test]
    fn scope_ref_carries_its_ids() {
        let session = FindScope::Session(vec!["a".into(), "b".into()]);
        let projected = FindScopeRefGql::from(&session);
        assert_eq!(projected.kind, FindScopeKindGql::Session);
        assert_eq!(projected.node_ids.as_deref().map(<[String]>::len), Some(2));
    }
}
