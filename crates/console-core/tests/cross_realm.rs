use commonplace_console_core::{fixture_snapshot, ConsoleSnapshot, ForceSim};

const CONSOLE_LAYOUT_SEED: u64 = 0x434f_4e53_4f4c_4531;
const CONSOLE_LAYOUT_FINGERPRINT: u64 = 10_496_215_397_300_334_112;

#[test]
fn canonical_fixture_round_trips_without_realm_drift() {
    let native = fixture_snapshot();
    let encoded = serde_json::to_vec(&native).expect("serialize canonical fixture");
    let decoded: ConsoleSnapshot =
        serde_json::from_slice(&encoded).expect("deserialize canonical fixture");

    assert_eq!(decoded, native);
    assert_eq!(
        native.overview.counts_by_type,
        vec![
            ("note".into(), 1),
            ("person".into(), 1),
            ("project".into(), 1),
            ("receipt".into(), 4),
        ]
    );
    assert_eq!(
        native
            .entities
            .iter()
            .map(|detail| detail.record.id.0.as_str())
            .collect::<Vec<_>>(),
        vec![
            "golden:person:ada",
            "golden:project:atlas",
            "golden:note:console",
        ]
    );
}

#[test]
fn native_console_seed_has_the_shared_settled_position_hash() {
    let mut simulation = ForceSim::new(&fixture_snapshot().graph, CONSOLE_LAYOUT_SEED);
    simulation.run_until_settled(10_000);
    assert!(simulation.settled());
    assert_eq!(
        simulation
            .frame_fingerprint(1_000_000.0)
            .expect("fixture frame fingerprint"),
        CONSOLE_LAYOUT_FINGERPRINT
    );
}
