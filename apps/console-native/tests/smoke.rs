use commonplace_console_core::{GoldenId, NodeId, Page, ReceiptFilter, ReceiptKind};
use commonplace_console_native::{GPUI_COMMIT, GPUI_COMPONENT_COMMIT, NativeConsoleModel};

#[test]
fn seeded_console_covers_all_five_surfaces() {
    let model = NativeConsoleModel::seeded();
    let receipt = model.smoke_receipt();

    assert_eq!(receipt.declared_surfaces.len(), 5);
    assert_eq!(receipt.entity_count, 3);
    assert_eq!(receipt.graph_node_count, 4);
    assert_eq!(receipt.watch_sequences, [1, 2, 3]);
    assert_eq!(receipt.gpui_commit, GPUI_COMMIT);
    assert_eq!(receipt.gpui_component_commit, GPUI_COMPONENT_COMMIT);
}

#[test]
fn graph_selection_resolves_the_matching_golden_entity() {
    let model = NativeConsoleModel::seeded();
    let selected = model
        .select_graph_node(&NodeId::new("node:ada"))
        .expect("select graph entity");

    assert_eq!(selected.to_string(), "golden:person:ada");
    assert_eq!(
        model.selected_entity_title().as_deref(),
        Some("Ada Lovelace")
    );
}

#[test]
fn entity_browser_exposes_merge_candidate_and_receipt_details() {
    let model = NativeConsoleModel::seeded();
    let detail = model
        .entity_detail(&GoldenId::new("golden:person:ada"))
        .expect("Ada detail");

    assert_eq!(detail.merges.len(), 1);
    assert_eq!(detail.candidates.len(), 1);
    assert_eq!(detail.receipts.len(), 2);
    assert_eq!(detail.candidates[0].shared_signals, ["name_prefix"]);
}

#[test]
fn receipt_browser_applies_typed_filters_and_bounded_pages() {
    let model = NativeConsoleModel::seeded();
    let filter = ReceiptFilter {
        kind: Some(ReceiptKind::Merge),
        subject_id: None,
    };
    let first = model
        .receipt_page(
            &filter,
            Page {
                cursor: None,
                limit: 1,
            },
        )
        .expect("first merge page");
    assert_eq!(first.receipts.len(), 1);
    assert_eq!(first.total, 2);

    let second = model
        .receipt_page(
            &filter,
            Page {
                cursor: first.next_cursor,
                limit: 1,
            },
        )
        .expect("second merge page");
    assert_eq!(second.receipts.len(), 1);
    assert!(second.next_cursor.is_none());
}

#[test]
fn watch_receives_a_post_attach_scripted_mutation() {
    let model = NativeConsoleModel::seeded();
    let sequence = model.emit_scripted_firing();
    let snapshot = model.watch_snapshot(i64::MAX);

    assert_eq!(
        snapshot.events.last().map(|event| event.sequence),
        Some(sequence)
    );
}

#[test]
fn watch_attaches_only_the_operator_selected_shape() {
    let model = NativeConsoleModel::seeded();
    model
        .select_watch_query("standing:project-health")
        .expect("select project watch");
    assert_eq!(model.selected_watch_query(), "standing:project-health");
    assert!(model.watch_snapshot(i64::MAX).events.is_empty());

    let sequence = model.emit_scripted_firing();
    let snapshot = model.watch_snapshot(i64::MAX);
    assert_eq!(snapshot.events.len(), 1);
    assert_eq!(snapshot.events[0].sequence, sequence);
    assert_eq!(snapshot.events[0].matched_ids, ["golden:project:atlas"]);
}
