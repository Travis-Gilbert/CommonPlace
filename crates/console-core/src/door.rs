use std::sync::Arc;

use crate::model::{
    ConsoleSnapshot, DoorError, DoorRequest, DoorResponse, EntityDetail, GoldenId, GraphSlice,
    NodeId, Page, ReceiptFilter, ReceiptPage, StandingFiring, StoreOverview, WatchRequest,
};

pub type SubscriptionSink = Arc<dyn Fn(StandingFiring) + Send + Sync + 'static>;

/// A realm-owned subscription whose lifetime controls the remote watch.
///
/// Implementations must make cancellation idempotent and cancel on drop. The
/// trait contains no GraphQL, browser, or native runtime types.
pub trait DoorSubscription: Send {
    fn id(&self) -> &str;
    fn is_active(&self) -> bool;
    fn cancel(&mut self);
}

/// Realm-neutral request door.
///
/// Native and web adapters are responsible for adding their API key or consent
/// token to the real transport. The core never receives or stores credentials.
pub trait Door {
    fn execute(&self, request: DoorRequest) -> Result<DoorResponse, DoorError>;

    fn subscribe(
        &self,
        request: WatchRequest,
        sink: SubscriptionSink,
    ) -> Result<Box<dyn DoorSubscription>, DoorError>;
}

pub fn overview(door: &dyn Door) -> Result<StoreOverview, DoorError> {
    match door.execute(DoorRequest::Overview)? {
        DoorResponse::Overview(value) => Ok(value),
        _ => Err(DoorError::protocol("overview")),
    }
}

pub fn entity(door: &dyn Door, id: GoldenId) -> Result<EntityDetail, DoorError> {
    match door.execute(DoorRequest::Entity { id })? {
        DoorResponse::Entity(value) => Ok(value),
        _ => Err(DoorError::protocol("entity")),
    }
}

pub fn receipts(
    door: &dyn Door,
    filter: &ReceiptFilter,
    page: Page,
) -> Result<ReceiptPage, DoorError> {
    match door.execute(DoorRequest::Receipts {
        filter: filter.clone(),
        page,
    })? {
        DoorResponse::Receipts(value) => Ok(value),
        _ => Err(DoorError::protocol("receipts")),
    }
}

pub fn neighborhood(door: &dyn Door, root: NodeId, depth: u8) -> Result<GraphSlice, DoorError> {
    match door.execute(DoorRequest::Neighborhood { root, depth })? {
        DoorResponse::Neighborhood(value) => Ok(value),
        _ => Err(DoorError::protocol("neighborhood")),
    }
}

pub fn snapshot(door: &dyn Door) -> Result<ConsoleSnapshot, DoorError> {
    match door.execute(DoorRequest::Snapshot)? {
        DoorResponse::Snapshot(value) => Ok(value),
        _ => Err(DoorError::protocol("snapshot")),
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Mutex;

    use super::*;
    use crate::fixture::FixtureDoor;
    use crate::model::{DoorErrorCode, ReceiptKind};

    #[test]
    fn door_helpers_round_trip_typed_results() {
        let door = FixtureDoor::default();

        assert_eq!(overview(&door).expect("overview").generation, 42);
        assert_eq!(
            entity(&door, GoldenId::new("golden:person:ada"))
                .expect("entity")
                .record
                .title,
            "Ada Lovelace"
        );

        let page = receipts(
            &door,
            &ReceiptFilter {
                kind: Some(ReceiptKind::Merge),
                subject_id: None,
            },
            Page {
                cursor: None,
                limit: 1,
            },
        )
        .expect("receipts");
        assert_eq!(page.receipts.len(), 1);
        assert_eq!(page.total, 2);

        let graph = neighborhood(&door, NodeId::new("node:ada"), 1).expect("graph");
        assert_eq!(graph.root, NodeId::new("node:ada"));
        assert_eq!(graph.nodes.len(), 3);
    }

    #[test]
    fn door_errors_survive_json_round_trip() {
        let error = entity(&FixtureDoor::default(), GoldenId::new("golden:missing"))
            .expect_err("missing fixture entity");
        assert_eq!(error.code, DoorErrorCode::NotFound);

        let encoded = serde_json::to_string(&error).expect("serialize error");
        let decoded: DoorError = serde_json::from_str(&encoded).expect("deserialize error");
        assert_eq!(decoded, error);
    }

    #[test]
    fn pagination_rejects_invalid_bounds_and_bad_cursors() {
        let door = FixtureDoor::default();
        let invalid_limit = receipts(
            &door,
            &ReceiptFilter::default(),
            Page {
                cursor: None,
                limit: 0,
            },
        )
        .expect_err("zero limit");
        assert_eq!(invalid_limit.code, DoorErrorCode::InvalidRequest);

        let invalid_cursor = receipts(
            &door,
            &ReceiptFilter::default(),
            Page {
                cursor: Some("not-a-number".into()),
                limit: 10,
            },
        )
        .expect_err("bad cursor");
        assert_eq!(invalid_cursor.code, DoorErrorCode::InvalidRequest);
    }

    #[test]
    fn subscription_is_realm_neutral_ordered_and_drop_scoped() {
        let door = FixtureDoor::default();
        let sequences = Arc::new(Mutex::new(Vec::new()));
        let captured = Arc::clone(&sequences);

        let subscription = door
            .subscribe(
                WatchRequest {
                    query_id: "standing:people-updated".into(),
                    from_sequence: 2,
                },
                Arc::new(move |event| {
                    captured.lock().expect("capture lock").push(event.sequence);
                }),
            )
            .expect("fixture subscription");

        assert!(subscription.is_active());
        assert_eq!(door.subscription_count(), 1);
        assert_eq!(*sequences.lock().expect("sequences"), [2, 3]);
        drop(subscription);
        assert_eq!(door.subscription_count(), 0);
    }
}
