//! GraphQL projection of the two-layer scatter (SPEC-COMMONPLACE-SEARCH-STACK
//! B5, surfaced by B7).
//!
//! ## Deviation: the scene rides inline, not behind a URL
//!
//! B7 asks for "the `SceneRef` for the compiled scene". The gateway's `SceneRef`
//! is `{ sceneId, url }` because that gateway serves `/scene/{id}` as rendered
//! HTML. `commonplace-api` has no such route, and the CommonPlace renderer
//! (`scene-host/renderers/ConstellationRenderer.tsx`) takes a `ScenePackageV2`
//! directly as a prop. Minting a URL for a route that does not exist would be a
//! placeholder, and making the client fetch it would add a round trip to get
//! back the object it already had. So `SceneRef` here carries the content
//! address plus the package itself. The id is still a stable handle for caching
//! and provenance.

use async_graphql::{Json, SimpleObject};
use rustyred_thg_find::{AspectId, AspectNode, FindScope, ScatterRequest, ScatterResponse};
use serde_json::Value;

use super::find::{FindHitGql, GraphRelationGql};

/// Inter-aspect similarity edge.
#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "AspectEdge")]
pub struct AspectEdgeGql {
    pub target: String,
    pub weight: f64,
}

#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "AspectNode")]
pub struct AspectNodeGql {
    pub id: String,
    pub label: String,
    pub seed_hits: Vec<FindHitGql>,
    pub relation: GraphRelationGql,
    pub edges: Vec<AspectEdgeGql>,
}

impl From<&AspectNode> for AspectNodeGql {
    fn from(aspect: &AspectNode) -> Self {
        Self {
            id: aspect.id.clone(),
            label: aspect.label.clone(),
            seed_hits: aspect.seed_hits.iter().map(FindHitGql::from).collect(),
            relation: aspect.relation.into(),
            edges: aspect
                .edges
                .iter()
                .map(|(target, weight)| AspectEdgeGql {
                    target: target.clone(),
                    weight: *weight as f64,
                })
                .collect(),
        }
    }
}

/// The compiled scene: a content address plus the `ScenePackageV2` itself.
#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "SceneRef")]
pub struct SceneRefGql {
    pub scene_id: String,
    /// The full `ScenePackageV2`, serialized. Its projection is `force_graph`.
    pub package: Json<Value>,
}

#[derive(Clone, Debug, SimpleObject)]
#[graphql(name = "ScatterResponse")]
pub struct ScatterResponseGql {
    pub query: String,
    pub aspects: Vec<AspectNodeGql>,
    pub lambda: f64,
    /// Which labeler named these aspects: `deterministic` or the model id.
    pub labeler: String,
    pub scopes_searched: Vec<String>,
    /// Set when this response is the expansion of an aspect.
    pub expanded_from: Option<String>,
    /// `None` only when scene compilation refused, and then `sceneRefusal` says
    /// why. Never a fabricated empty scene.
    pub scene: Option<SceneRefGql>,
    pub scene_refusal: Option<String>,
    pub scatter_ref: String,
}

impl From<ScatterResponse> for ScatterResponseGql {
    fn from(response: ScatterResponse) -> Self {
        let scene = response.scene.as_ref().and_then(|package| {
            serde_json::to_value(package).ok().map(|value| SceneRefGql {
                scene_id: package.id.clone(),
                package: Json(value),
            })
        });
        Self {
            query: response.query,
            aspects: response.aspects.iter().map(AspectNodeGql::from).collect(),
            lambda: response.lambda as f64,
            labeler: response.labeler,
            scopes_searched: response.scopes_searched,
            expanded_from: response.expanded_from,
            scene,
            scene_refusal: response.scene_refusal,
            scatter_ref: response.scatter_ref,
        }
    }
}

/// Build the scatter request, clamping `k` to the hard aspect cap.
pub fn build_request(
    query: String,
    scopes: Option<Vec<super::find::FindScopeInput>>,
    k: Option<i32>,
    lambda: Option<f64>,
) -> Result<ScatterRequest, String> {
    let scopes = match scopes {
        Some(scopes) if !scopes.is_empty() => scopes
            .into_iter()
            .map(super::find::FindScopeInput::into_scope)
            .collect::<Result<Vec<_>, _>>()?,
        _ => vec![FindScope::Corpus],
    };
    let defaults = ScatterRequest::default();
    Ok(ScatterRequest {
        query,
        scopes,
        k: k.unwrap_or(defaults.k as i32)
            .clamp(1, rustyred_thg_find::MAX_ASPECTS as i32) as usize,
        lambda: lambda.unwrap_or(defaults.lambda as f64).clamp(0.0, 1.0) as f32,
        ..defaults
    })
}

/// Aspect id from a GraphQL argument, rejected early when blank so the executor
/// is never asked to expand nothing.
pub fn parse_aspect_id(aspect_id: String) -> Result<AspectId, String> {
    let trimmed = aspect_id.trim();
    if trimmed.is_empty() {
        Err("expand requires an aspectId".to_string())
    } else {
        Ok(trimmed.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scatter_k_is_clamped_to_the_aspect_cap() {
        let request = build_request("q".into(), None, Some(50), None).expect("request");
        assert_eq!(request.k, rustyred_thg_find::MAX_ASPECTS);
        let request = build_request("q".into(), None, Some(0), None).expect("request");
        assert_eq!(request.k, 1);
    }

    #[test]
    fn scatter_lambda_is_clamped() {
        let request = build_request("q".into(), None, None, Some(4.0)).expect("request");
        assert_eq!(request.lambda, 1.0);
    }

    #[test]
    fn blank_aspect_id_is_refused() {
        assert!(parse_aspect_id("   ".into()).is_err());
        assert_eq!(parse_aspect_id(" a1 ".into()).expect("id"), "a1");
    }
}
