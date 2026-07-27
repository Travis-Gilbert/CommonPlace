use std::collections::{BTreeMap, BTreeSet, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use serde_json::json;

use crate::door::{Door, DoorSubscription, SubscriptionSink};
use crate::model::*;

#[derive(Clone)]
pub struct FixtureDoor {
    snapshot: ConsoleSnapshot,
    subscriptions: Arc<Mutex<BTreeMap<String, FixtureWatch>>>,
    next_subscription: Arc<AtomicU64>,
}

impl Default for FixtureDoor {
    fn default() -> Self {
        Self {
            snapshot: fixture_snapshot(),
            subscriptions: Arc::new(Mutex::new(BTreeMap::new())),
            next_subscription: Arc::new(AtomicU64::new(1)),
        }
    }
}

impl FixtureDoor {
    pub fn from_snapshot(snapshot: ConsoleSnapshot) -> Self {
        Self {
            snapshot,
            subscriptions: Arc::new(Mutex::new(BTreeMap::new())),
            next_subscription: Arc::new(AtomicU64::new(1)),
        }
    }

    pub fn subscription_count(&self) -> usize {
        self.subscriptions
            .lock()
            .expect("fixture subscription registry")
            .len()
    }

    pub fn emit_firing(&self, firing: StandingFiring) -> usize {
        let sinks = self
            .subscriptions
            .lock()
            .expect("fixture subscription registry")
            .values()
            .filter(|watch| {
                watch.request.query_id == firing.query_id
                    && firing.sequence >= watch.request.from_sequence
            })
            .map(|watch| Arc::clone(&watch.sink))
            .collect::<Vec<_>>();

        for sink in &sinks {
            sink(firing.clone());
        }
        sinks.len()
    }
}

impl Door for FixtureDoor {
    fn execute(&self, request: DoorRequest) -> Result<DoorResponse, DoorError> {
        match request {
            DoorRequest::Overview => Ok(DoorResponse::Overview(self.snapshot.overview.clone())),
            DoorRequest::Entity { id } => self
                .snapshot
                .entities
                .iter()
                .find(|detail| detail.record.id == id)
                .cloned()
                .map(DoorResponse::Entity)
                .ok_or_else(|| {
                    DoorError::new(
                        DoorErrorCode::NotFound,
                        format!("entity {id} was not found"),
                        false,
                    )
                }),
            DoorRequest::Receipts { filter, page } => {
                Ok(DoorResponse::Receipts(self.receipt_page(&filter, &page)?))
            }
            DoorRequest::Neighborhood { root, depth } => Ok(DoorResponse::Neighborhood(
                self.neighborhood_slice(root, depth)?,
            )),
            DoorRequest::Snapshot => Ok(DoorResponse::Snapshot(self.snapshot.clone())),
        }
    }

    fn subscribe(
        &self,
        request: WatchRequest,
        sink: SubscriptionSink,
    ) -> Result<Box<dyn DoorSubscription>, DoorError> {
        if !self
            .snapshot
            .standing_queries
            .iter()
            .any(|query| query.id == request.query_id)
        {
            return Err(DoorError::new(
                DoorErrorCode::NotFound,
                format!("standing query {} was not found", request.query_id),
                false,
            ));
        }

        let sequence = self.next_subscription.fetch_add(1, Ordering::Relaxed);
        let id = format!("fixture-subscription:{sequence}");
        self.subscriptions
            .lock()
            .expect("fixture subscription registry")
            .insert(
                id.clone(),
                FixtureWatch {
                    request: request.clone(),
                    sink: Arc::clone(&sink),
                },
            );

        for firing in self.snapshot.firings.iter().filter(|firing| {
            firing.query_id == request.query_id && firing.sequence >= request.from_sequence
        }) {
            sink(firing.clone());
        }

        Ok(Box::new(FixtureSubscription {
            id,
            registry: Arc::clone(&self.subscriptions),
            active: true,
        }))
    }
}

struct FixtureWatch {
    request: WatchRequest,
    sink: SubscriptionSink,
}

struct FixtureSubscription {
    id: String,
    registry: Arc<Mutex<BTreeMap<String, FixtureWatch>>>,
    active: bool,
}

impl DoorSubscription for FixtureSubscription {
    fn id(&self) -> &str {
        &self.id
    }

    fn is_active(&self) -> bool {
        self.active
    }

    fn cancel(&mut self) {
        if self.active {
            self.registry
                .lock()
                .expect("fixture subscription registry")
                .remove(&self.id);
            self.active = false;
        }
    }
}

impl Drop for FixtureSubscription {
    fn drop(&mut self) {
        self.cancel();
    }
}

impl FixtureDoor {
    fn receipt_page(&self, filter: &ReceiptFilter, page: &Page) -> Result<ReceiptPage, DoorError> {
        if !(1..=250).contains(&page.limit) {
            return Err(DoorError::new(
                DoorErrorCode::InvalidRequest,
                "receipt page limit must be between 1 and 250",
                false,
            ));
        }
        let offset = match &page.cursor {
            Some(cursor) => cursor.parse::<usize>().map_err(|_| {
                DoorError::new(
                    DoorErrorCode::InvalidRequest,
                    "receipt cursor must be a decimal offset",
                    false,
                )
            })?,
            None => 0,
        };
        let matching = self
            .snapshot
            .receipts
            .iter()
            .filter(|receipt| {
                filter.kind.map_or(true, |kind| receipt.kind == kind)
                    && filter
                        .subject_id
                        .as_ref()
                        .map_or(true, |subject| &receipt.subject_id == subject)
            })
            .cloned()
            .collect::<Vec<_>>();
        if offset > matching.len() {
            return Err(DoorError::new(
                DoorErrorCode::InvalidRequest,
                "receipt cursor is beyond the result set",
                false,
            ));
        }
        let end = (offset + usize::from(page.limit)).min(matching.len());
        let next_cursor = (end < matching.len()).then(|| end.to_string());
        Ok(ReceiptPage {
            receipts: matching[offset..end].to_vec(),
            next_cursor,
            total: matching.len() as u64,
        })
    }

    fn neighborhood_slice(&self, root: NodeId, depth: u8) -> Result<GraphSlice, DoorError> {
        if !self.snapshot.graph.nodes.iter().any(|node| node.id == root) {
            return Err(DoorError::new(
                DoorErrorCode::NotFound,
                format!("graph node {root} was not found"),
                false,
            ));
        }

        let mut included = BTreeSet::from([root.clone()]);
        let mut queue = VecDeque::from([(root.clone(), 0_u8)]);
        while let Some((current, current_depth)) = queue.pop_front() {
            if current_depth >= depth {
                continue;
            }
            for edge in &self.snapshot.graph.edges {
                let neighbor = if edge.source == current {
                    Some(edge.target.clone())
                } else if edge.target == current {
                    Some(edge.source.clone())
                } else {
                    None
                };
                if let Some(neighbor) = neighbor {
                    if included.insert(neighbor.clone()) {
                        queue.push_back((neighbor, current_depth + 1));
                    }
                }
            }
        }

        let nodes = self
            .snapshot
            .graph
            .nodes
            .iter()
            .filter(|node| included.contains(&node.id))
            .cloned()
            .collect();
        let edges = self
            .snapshot
            .graph
            .edges
            .iter()
            .filter(|edge| included.contains(&edge.source) && included.contains(&edge.target))
            .cloned()
            .collect();
        Ok(GraphSlice {
            root,
            depth,
            nodes,
            edges,
        })
    }
}

pub fn fixture_snapshot() -> ConsoleSnapshot {
    let ada_id = GoldenId::new("golden:person:ada");
    let atlas_id = GoldenId::new("golden:project:atlas");
    let note_id = GoldenId::new("golden:note:console");

    let merge_receipts = vec![
        MergeReceipt {
            id: "merge:ada-001".into(),
            golden_id: ada_id.clone(),
            merged_ids: vec![
                "source:contacts:ada".into(),
                "source:mail:a-lovelace".into(),
            ],
            confidence_ppm: 982_000,
            decided_at_ms: 1_784_620_800_000,
            basis: vec!["email_exact".into(), "name_normalized".into()],
        },
        MergeReceipt {
            id: "merge:atlas-001".into(),
            golden_id: atlas_id.clone(),
            merged_ids: vec!["source:notes:atlas".into(), "source:tasks:atlas".into()],
            confidence_ppm: 941_000,
            decided_at_ms: 1_784_624_400_000,
            basis: vec!["title_exact".into(), "member_overlap".into()],
        },
    ];

    let receipts = vec![
        Receipt {
            id: "receipt:merge:ada-001".into(),
            kind: ReceiptKind::Merge,
            subject_id: ada_id.to_string(),
            actor: "reconcile-agent".into(),
            occurred_at_ms: 1_784_620_800_000,
            summary: "Merged two source identities into Ada Lovelace".into(),
            evidence: BTreeMap::from([("confidence_ppm".into(), json!(982_000))]),
        },
        Receipt {
            id: "receipt:merge:atlas-001".into(),
            kind: ReceiptKind::Merge,
            subject_id: atlas_id.to_string(),
            actor: "reconcile-agent".into(),
            occurred_at_ms: 1_784_624_400_000,
            summary: "Merged project notes and tasks into Atlas".into(),
            evidence: BTreeMap::from([("confidence_ppm".into(), json!(941_000))]),
        },
        Receipt {
            id: "receipt:watch:people-003".into(),
            kind: ReceiptKind::QueryFiring,
            subject_id: "standing:people-updated".into(),
            actor: "standing-query-engine".into(),
            occurred_at_ms: 1_784_627_100_000,
            summary: "People updated query matched Ada Lovelace".into(),
            evidence: BTreeMap::from([("sequence".into(), json!(3))]),
        },
        Receipt {
            id: "receipt:consent:console-001".into(),
            kind: ReceiptKind::Consent,
            subject_id: "commonplace.console".into(),
            actor: "fixture-user".into(),
            occurred_at_ms: 1_784_627_200_000,
            summary: "Granted read-only corpus access".into(),
            evidence: BTreeMap::from([("grant".into(), json!("corpus:read"))]),
        },
    ];

    let entities = vec![
        EntityDetail {
            record: GoldenRecord {
                id: ada_id.clone(),
                entity_type: "person".into(),
                title: "Ada Lovelace".into(),
                fields: BTreeMap::from([
                    ("email".into(), json!("ada@example.test")),
                    ("role".into(), json!("Mathematician")),
                ]),
                updated_at_ms: 1_784_627_100_000,
            },
            merges: vec![merge_receipts[0].clone()],
            receipts: vec![receipts[0].clone(), receipts[2].clone()],
            candidates: vec![DoppelgangerCandidate {
                candidate_id: GoldenId::new("candidate:person:ada-byron"),
                confidence_ppm: 380_000,
                shared_signals: vec!["name_prefix".into()],
            }],
        },
        EntityDetail {
            record: GoldenRecord {
                id: atlas_id.clone(),
                entity_type: "project".into(),
                title: "Atlas".into(),
                fields: BTreeMap::from([
                    ("status".into(), json!("active")),
                    ("owner".into(), json!(ada_id.to_string())),
                ]),
                updated_at_ms: 1_784_624_400_000,
            },
            merges: vec![merge_receipts[1].clone()],
            receipts: vec![receipts[1].clone()],
            candidates: Vec::new(),
        },
        EntityDetail {
            record: GoldenRecord {
                id: note_id.clone(),
                entity_type: "note".into(),
                title: "Console architecture".into(),
                fields: BTreeMap::from([
                    ("project".into(), json!(atlas_id.to_string())),
                    ("status".into(), json!("reviewed")),
                ]),
                updated_at_ms: 1_784_626_000_000,
            },
            merges: Vec::new(),
            receipts: Vec::new(),
            candidates: Vec::new(),
        },
    ];

    ConsoleSnapshot {
        contract_version: CONSOLE_CORE_CONTRACT_VERSION.into(),
        overview: StoreOverview {
            counts_by_type: vec![
                ("note".into(), 1),
                ("person".into(), 1),
                ("project".into(), 1),
                ("receipt".into(), receipts.len() as u64),
            ],
            generation: 42,
            readiness: vec![
                CapabilityReadiness {
                    capability: "graph".into(),
                    state: ReadinessState::Ready,
                    detail: "generation 42 indexed".into(),
                },
                CapabilityReadiness {
                    capability: "standing_queries".into(),
                    state: ReadinessState::Ready,
                    detail: "two definitions loaded".into(),
                },
            ],
        },
        entities,
        receipts,
        graph: GraphSlice {
            root: NodeId::new("node:ada"),
            depth: 2,
            nodes: vec![
                GraphNode {
                    id: NodeId::new("node:ada"),
                    golden_id: Some(ada_id),
                    node_type: "person".into(),
                    label: "Ada Lovelace".into(),
                },
                GraphNode {
                    id: NodeId::new("node:atlas"),
                    golden_id: Some(atlas_id),
                    node_type: "project".into(),
                    label: "Atlas".into(),
                },
                GraphNode {
                    id: NodeId::new("node:console-note"),
                    golden_id: Some(note_id),
                    node_type: "note".into(),
                    label: "Console architecture".into(),
                },
                GraphNode {
                    id: NodeId::new("node:standing-people"),
                    golden_id: None,
                    node_type: "standing_query".into(),
                    label: "People updated".into(),
                },
            ],
            edges: vec![
                GraphEdge {
                    id: "edge:ada-atlas".into(),
                    source: NodeId::new("node:ada"),
                    target: NodeId::new("node:atlas"),
                    edge_type: "owns".into(),
                    weight: 1.0,
                },
                GraphEdge {
                    id: "edge:atlas-note".into(),
                    source: NodeId::new("node:atlas"),
                    target: NodeId::new("node:console-note"),
                    edge_type: "contains".into(),
                    weight: 0.8,
                },
                GraphEdge {
                    id: "edge:watch-ada".into(),
                    source: NodeId::new("node:standing-people"),
                    target: NodeId::new("node:ada"),
                    edge_type: "matched".into(),
                    weight: 0.6,
                },
            ],
        },
        standing_queries: vec![
            StandingQueryDefinition {
                id: "standing:people-updated".into(),
                name: "People updated".into(),
                shape: "person.updated_at_ms > cursor".into(),
                enabled: true,
            },
            StandingQueryDefinition {
                id: "standing:project-health".into(),
                name: "Project health".into(),
                shape: "project.status = active".into(),
                enabled: true,
            },
        ],
        firings: vec![
            StandingFiring {
                query_id: "standing:people-updated".into(),
                sequence: 1,
                occurred_at_ms: 1_784_627_000_000,
                matched_ids: vec!["golden:person:ada".into()],
                receipt_id: "receipt:watch:people-001".into(),
            },
            StandingFiring {
                query_id: "standing:people-updated".into(),
                sequence: 2,
                occurred_at_ms: 1_784_627_050_000,
                matched_ids: vec!["golden:person:ada".into()],
                receipt_id: "receipt:watch:people-002".into(),
            },
            StandingFiring {
                query_id: "standing:people-updated".into(),
                sequence: 3,
                occurred_at_ms: 1_784_627_100_000,
                matched_ids: vec!["golden:person:ada".into()],
                receipt_id: "receipt:watch:people-003".into(),
            },
        ],
        plugin: PluginInfo {
            app_id: "commonplace.console".into(),
            version: "1.0.0".into(),
            state: PluginState::Installed,
            grants: vec!["corpus:read".into()],
            contributions: vec!["pane:commonplace.console".into()],
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fixture_serialization_is_byte_stable() {
        let left = serde_json::to_vec(&fixture_snapshot()).expect("serialize fixture");
        let right = serde_json::to_vec(&fixture_snapshot()).expect("serialize fixture again");
        assert_eq!(left, right);
    }
}
