//! Acceptance for the CommonPlace -> Plane parity backbone.
//!
//! The point is not to clone Plane storage. These checks prove the Plane-like PM
//! constructs land as CommonPlace graph nodes/edges, so tasks can still point at
//! knowledge through `ABOUT` and PM views can read one RustyRed substrate.

use commonplace::{
    CollectionKind, Commonplace, InMemoryBlobStore, Item, ItemKind, ABOUT_EDGE, BLOCKS_EDGE,
    COMMENT_ON_EDGE, HAS_STATE_EDGE, IN_CYCLE_EDGE, IN_MODULE_EDGE, IN_PROJECT_EDGE, LINKS_TO_EDGE,
    LOGGED_ON_EDGE,
};
use rustyred_thg_core::{InMemoryGraphStore, NeighborQuery};
use serde_json::json;

type Cp = Commonplace<InMemoryGraphStore, InMemoryBlobStore>;

fn fresh() -> Cp {
    Commonplace::new(InMemoryGraphStore::new(), InMemoryBlobStore::new())
}

#[test]
fn plane_parity_constructs_share_the_commonplace_graph() {
    let mut cp = fresh();

    let project = cp.create_project("CommonPlace", "CP").unwrap();
    assert_eq!(project.kind, CollectionKind::Project);
    assert_eq!(project.identifier.as_deref(), Some("CP"));
    assert_eq!(project.feature_flags.get("states"), Some(&true));

    let backlog = cp
        .create_state(&project.id, "Backlog", "backlog", 0)
        .unwrap();
    let started = cp
        .create_state(&project.id, "Started", "started", 1)
        .unwrap();
    let states = cp.project_states(&project.id).unwrap();
    assert_eq!(
        states
            .iter()
            .map(|state| state.title.as_str())
            .collect::<Vec<_>>(),
        vec!["Backlog", "Started"]
    );

    let task = cp
        .put_item(
            Item::task("Wire Plane parity", "Add graph-native PM primitives.")
                .with_extra("sequence_id", json!("CP-1"))
                .with_extra("estimate_point", json!(3)),
        )
        .unwrap();
    cp.add_to_project(&task.id, &project.id).unwrap();
    cp.set_task_state(&task.id, &started.id).unwrap();
    let loaded_task = cp.get_item(&task.id).unwrap().unwrap();
    assert_eq!(loaded_task.status.as_deref(), Some("Started"));
    assert_eq!(cp.task_state(&task.id).unwrap().unwrap().id, started.id);

    let doc = cp
        .put_item(Item::new(ItemKind::Doc, "Parity spec").with_text("ABOUT stays central."))
        .unwrap();
    cp.link_about(&task.id, &doc.id).unwrap();
    assert_eq!(cp.task_about(&task.id).unwrap(), vec![doc.id.clone()]);

    let cycle = cp
        .create_cycle(
            &project.id,
            "June sprint",
            1_720_000_000_000,
            1_722_000_000_000,
        )
        .unwrap();
    cp.add_to_cycle(&task.id, &cycle.id).unwrap();
    let module = cp.create_module(&project.id, "Data views").unwrap();
    cp.add_to_module(&task.id, &module.id).unwrap();
    assert_eq!(cp.project_cycles(&project.id).unwrap()[0].id, cycle.id);
    assert_eq!(cp.project_modules(&project.id).unwrap()[0].id, module.id);
    assert_eq!(cp.project_work_items(&project.id).unwrap()[0].id, task.id);

    let label = cp
        .scope_label_to_project(&project.id, "frontend", Some("#2D5F6B".to_string()))
        .unwrap();
    let labels = cp.project_labels(&project.id).unwrap();
    assert_eq!(labels[0].0.id, label.id);
    assert_eq!(labels[0].1.as_deref(), Some("#2D5F6B"));

    let comment = cp
        .create_comment(&task.id, Some("member:travis".to_string()), "Looks right.")
        .unwrap();
    assert_eq!(cp.comments_for(&task.id).unwrap()[0].id, comment.id);

    let worklog = cp
        .log_work(
            &task.id,
            45 * 60 * 1000,
            Some("member:travis".to_string()),
            Some("Implementation pass".to_string()),
        )
        .unwrap();
    assert_eq!(cp.worklogs_for(&task.id).unwrap()[0].id, worklog.id);
    assert_eq!(
        cp.total_worklog_duration_ms(&task.id).unwrap(),
        45 * 60 * 1000
    );

    let link = cp
        .link_work_item_url(
            &task.id,
            "Plane API",
            "https://developers.plane.so/api-reference",
        )
        .unwrap();
    assert_eq!(link.kind, ItemKind::Link);

    let blocked = cp
        .put_item(Item::task("Publish PM API", "Expose the parity query."))
        .unwrap();
    cp.add_to_project(&blocked.id, &project.id).unwrap();
    cp.link_work_items(&task.id, &blocked.id, "blocks").unwrap();

    let sticky = cp
        .create_sticky(
            Some(project.id.clone()),
            "Keep graph-native",
            "Do not split tasks from docs.",
            Some("#2D5F6B".to_string()),
            Some("#F5F0E8".to_string()),
            Some(10),
        )
        .unwrap();
    assert_eq!(sticky.kind, ItemKind::Sticky);

    assert_edge(&cp, &task.id, IN_PROJECT_EDGE, &project.id);
    assert_edge(&cp, &task.id, HAS_STATE_EDGE, &started.id);
    assert_edge(&cp, &task.id, ABOUT_EDGE, &doc.id);
    assert_edge(&cp, &task.id, IN_CYCLE_EDGE, &cycle.id);
    assert_edge(&cp, &task.id, IN_MODULE_EDGE, &module.id);
    assert_edge(&cp, &comment.id, COMMENT_ON_EDGE, &task.id);
    assert_edge(&cp, &worklog.id, LOGGED_ON_EDGE, &task.id);
    assert_edge(&cp, &task.id, LINKS_TO_EDGE, &link.id);
    assert_edge(&cp, &task.id, BLOCKS_EDGE, &blocked.id);

    let backlog_hits = cp
        .store()
        .neighbors(NeighborQuery::in_(&project.id).with_edge_type(IN_PROJECT_EDGE));
    assert!(backlog_hits.iter().any(|hit| hit.node_id == backlog.id));
}

fn assert_edge(cp: &Cp, from: &str, edge_type: &str, to: &str) {
    let found = cp
        .store()
        .neighbors(NeighborQuery::out(from).with_edge_type(edge_type))
        .into_iter()
        .any(|hit| hit.node_id == to);
    assert!(found, "missing edge {from} -{edge_type}-> {to}");
}
