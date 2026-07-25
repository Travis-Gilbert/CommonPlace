use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

use commonplace_console_core::{
    ConsoleSnapshot, DoorError, EntityDetail, FixtureDoor, ForceSim, GoldenId, NodeId, Page,
    ReceiptFilter, ReceiptPage, StandingFiring, WatchConfig, WatchError, WatchFilter,
    WatchInspector, WatchRequest, WatchSnapshot, fixture_snapshot, receipts,
};
use serde::Serialize;

use crate::shell::SurfaceId;
use crate::{GPUI_COMMIT, GPUI_COMPONENT_COMMIT, GPUI_COMPONENT_VERSION, GPUI_VERSION};

pub struct NativeConsoleModel {
    snapshot: ConsoleSnapshot,
    positions: Vec<commonplace_console_core::NodePos>,
    position_fingerprint: u64,
    door: FixtureDoor,
    watch: Mutex<WatchInspector>,
    scripted_firings: Vec<StandingFiring>,
    selected_watch_query: Mutex<String>,
    selected_entity: Mutex<Option<GoldenId>>,
    next_sequence: AtomicU64,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct NativeSmokeReceipt {
    pub contract_version: String,
    pub entity_count: usize,
    pub receipt_count: usize,
    pub graph_node_count: usize,
    pub graph_position_fingerprint: u64,
    pub watch_sequences: Vec<u64>,
    pub declared_surfaces: Vec<String>,
    pub gpui_version: &'static str,
    pub gpui_commit: &'static str,
    pub gpui_component_version: &'static str,
    pub gpui_component_commit: &'static str,
}

impl NativeConsoleModel {
    pub fn seeded() -> Self {
        let snapshot = fixture_snapshot();
        let mut simulation = ForceSim::new(&snapshot.graph, 0x434f_4e53_4f4c_4531);
        simulation.run_until_settled(10_000);
        let position_fingerprint = simulation
            .frame_fingerprint(1_000_000.0)
            .expect("fixture frame fingerprint");
        let positions = simulation.positions().to_vec();

        let mut watch_source = snapshot.clone();
        let scripted_firings = std::mem::take(&mut watch_source.firings);
        let door = FixtureDoor::from_snapshot(watch_source);
        let query_id = snapshot
            .standing_queries
            .first()
            .map(|query| query.id.clone())
            .expect("fixture standing query");
        let watch = WatchInspector::attach(
            &door,
            WatchRequest {
                query_id: query_id.clone(),
                from_sequence: 0,
            },
            WatchConfig::default(),
            WatchFilter::default(),
        )
        .expect("fixture watch inspector");
        for firing in &scripted_firings {
            door.emit_firing(firing.clone());
        }
        let next_sequence = scripted_firings
            .iter()
            .map(|event| event.sequence)
            .max()
            .unwrap_or(0)
            .saturating_add(1);

        Self {
            snapshot,
            positions,
            position_fingerprint,
            door,
            watch: Mutex::new(watch),
            scripted_firings,
            selected_watch_query: Mutex::new(query_id),
            selected_entity: Mutex::new(None),
            next_sequence: AtomicU64::new(next_sequence),
        }
    }

    pub fn snapshot(&self) -> &ConsoleSnapshot {
        &self.snapshot
    }

    pub fn positions(&self) -> &[commonplace_console_core::NodePos] {
        &self.positions
    }

    pub fn watch_snapshot(&self, now_ms: i64) -> WatchSnapshot {
        self.watch
            .lock()
            .expect("watch inspector")
            .snapshot(now_ms)
            .expect("watch snapshot")
    }

    pub fn selected_watch_query(&self) -> String {
        self.selected_watch_query
            .lock()
            .expect("selected watch query")
            .clone()
    }

    pub fn select_watch_query(&self, query_id: &str) -> Result<(), WatchError> {
        let next_watch = WatchInspector::attach(
            &self.door,
            WatchRequest {
                query_id: query_id.to_string(),
                from_sequence: 0,
            },
            WatchConfig::default(),
            WatchFilter::default(),
        )?;
        *self.watch.lock().expect("watch inspector") = next_watch;
        *self
            .selected_watch_query
            .lock()
            .expect("selected watch query") = query_id.to_string();

        for firing in self
            .scripted_firings
            .iter()
            .filter(|firing| firing.query_id == query_id)
        {
            self.door.emit_firing(firing.clone());
        }
        Ok(())
    }

    pub fn pause_watch(&self) {
        self.watch
            .lock()
            .expect("watch inspector")
            .pause()
            .expect("pause watch");
    }

    pub fn resume_watch(&self) {
        self.watch
            .lock()
            .expect("watch inspector")
            .resume()
            .expect("resume watch");
    }

    pub fn emit_scripted_firing(&self) -> u64 {
        let sequence = self.next_sequence.fetch_add(1, Ordering::Relaxed);
        let query_id = self.selected_watch_query();
        let base_time = self
            .snapshot
            .firings
            .iter()
            .map(|event| event.occurred_at_ms)
            .max()
            .unwrap_or(1_784_627_100_000);
        self.door.emit_firing(StandingFiring {
            query_id: query_id.clone(),
            sequence,
            occurred_at_ms: base_time.saturating_add(sequence as i64 * 1_000),
            matched_ids: if query_id == "standing:project-health" {
                vec!["golden:project:atlas".into()]
            } else {
                vec!["golden:person:ada".into()]
            },
            receipt_id: format!("receipt:{query_id}:{sequence}"),
        });
        sequence
    }

    pub fn select_graph_node(&self, node_id: &NodeId) -> Option<GoldenId> {
        let golden_id = self
            .snapshot
            .graph
            .nodes
            .iter()
            .find(|node| &node.id == node_id)
            .and_then(|node| node.golden_id.clone());
        *self.selected_entity.lock().expect("selected entity") = golden_id.clone();
        golden_id
    }

    pub fn selected_entity(&self) -> Option<GoldenId> {
        self.selected_entity
            .lock()
            .expect("selected entity")
            .clone()
    }

    pub fn selected_entity_title(&self) -> Option<String> {
        let selected = self.selected_entity()?;
        self.snapshot
            .entities
            .iter()
            .find(|detail| detail.record.id == selected)
            .map(|detail| detail.record.title.clone())
    }

    pub fn entity_detail(&self, id: &GoldenId) -> Option<&EntityDetail> {
        self.snapshot
            .entities
            .iter()
            .find(|detail| &detail.record.id == id)
    }

    pub fn receipt_page(
        &self,
        filter: &ReceiptFilter,
        page: Page,
    ) -> Result<ReceiptPage, DoorError> {
        receipts(&self.door, filter, page)
    }

    pub fn smoke_receipt(&self) -> NativeSmokeReceipt {
        let now_ms = self
            .snapshot
            .firings
            .iter()
            .map(|event| event.occurred_at_ms)
            .max()
            .unwrap_or(0)
            .saturating_add(60_000);
        NativeSmokeReceipt {
            contract_version: self.snapshot.contract_version.clone(),
            entity_count: self.snapshot.entities.len(),
            receipt_count: self.snapshot.receipts.len(),
            graph_node_count: self.snapshot.graph.nodes.len(),
            graph_position_fingerprint: self.position_fingerprint,
            watch_sequences: self
                .watch_snapshot(now_ms)
                .events
                .into_iter()
                .map(|event| event.sequence)
                .collect(),
            declared_surfaces: SurfaceId::ALL
                .iter()
                .map(|surface| surface.title().to_string())
                .collect(),
            gpui_version: GPUI_VERSION,
            gpui_commit: GPUI_COMMIT,
            gpui_component_version: GPUI_COMPONENT_VERSION,
            gpui_component_commit: GPUI_COMPONENT_COMMIT,
        }
    }
}
