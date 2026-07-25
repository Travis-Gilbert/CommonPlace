use browser_core::*;

#[test]
fn tab_history_round_trips_through_session_graph() {
    let mut g = SessionGraph::new();
    let tab = g.open_tab(1);
    g.navigate(tab, "https://a.example/".into(), "A".into(), 2);
    g.navigate(tab, "https://b.example/".into(), "B".into(), 3);
    g.navigate(tab, "https://c.example/".into(), "C".into(), 4);
    let chain = g.visit_chain(tab);
    assert_eq!(chain.len(), 3);
    assert_eq!(chain[0].url_canon, "https://a.example/");
    assert_eq!(chain[2].title, "C");

    let json = g.to_json().unwrap();
    let restored = SessionGraph::from_json(&json).unwrap();
    assert_eq!(restored.visit_chain(tab).len(), 3);
    assert_eq!(restored.open_tabs(), vec![tab]);
}

#[test]
fn permission_and_download_receipts() {
    let mut store = PermissionStore::new();
    let p = store.grant(
        "https://example.com",
        PermissionKind::Notifications,
        PermissionDecision::Allow,
        10,
    );
    let d = store.record_download("https://example.com/f.bin", "f.bin", 42, 11);
    assert_eq!(store.permission_receipts(), &[p]);
    assert_eq!(store.download_receipts(), &[d]);
}

#[test]
fn update_check_parses_fixture_and_never_auto_applies() {
    let feed = r#"{
      "app_name": "commonplace-browser-native",
      "releases": [
        { "version": "0.1.0", "url": "https://example.com/0.1.0" },
        { "version": "0.2.0", "url": "https://example.com/0.2.0" }
      ]
    }"#;
    let result = check_update_feed(feed, "0.1.0").unwrap();
    assert_eq!(result.newer.as_ref().unwrap().version, "0.2.0");
    assert!(!result.auto_applied);
}

#[test]
fn second_launch_delivers_argv_to_primary() {
    let dir = tempfile::tempdir().unwrap();
    let primary = SingleInstanceServer::acquire(dir.path(), &[]).unwrap();
    let secondary = SingleInstanceServer::acquire(
        dir.path(),
        &["commonplace-browser-native".into(), "https://example.com".into()],
    );
    assert!(matches!(
        secondary,
        Err(SingleInstanceError::DeliveredToPrimary)
    ));
    // Give the accept thread a moment.
    std::thread::sleep(std::time::Duration::from_millis(50));
    let argv = primary.try_recv_argv().expect("primary should receive argv");
    assert!(argv.iter().any(|a| a.contains("example.com")));
}

#[test]
fn registration_status_is_honest() {
    let status = protocol_registration_status();
    assert!(matches!(
        status,
        RegistrationStatus::NotVerified
            | RegistrationStatus::VerifiedOnMacos
            | RegistrationStatus::Unsupported
    ));
    // Until OS dialog flow is captured, we must not claim VerifiedOnMacos.
    assert_ne!(status, RegistrationStatus::VerifiedOnMacos);
}
