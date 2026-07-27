//! B2 supervision, against a real child process.
//!
//! The engine is faked (`src/bin/fake-pane-host.rs`) because libservo cannot be
//! built here, but the process, the pipes, the framing, the request/response
//! correlation, the death of the child and the respawn are all real. That is
//! the half of the acceptance criterion a unit test cannot reach.
//!
//! What this does NOT prove: that the restored URL came from the session graph.
//! The local RustyRed node is not running in a test, so the graph read fails and
//! the supervisor falls back to the URL the chrome asked for. The graph half of
//! the rule is covered by `reseed_plan`'s unit tests and by
//! `pane_host::session`'s.

use std::sync::{Mutex, MutexGuard};
use std::time::{Duration, Instant};

use pane_protocol::{Bounds, ParentSurface};
use tauri_plugin_servo_panes::{HostConfig, Supervisor};

/// A local node address nothing is listening on. The session graph is expected
/// to fail here; a graph write must never be able to break a navigation.
const NO_NODE: &str = "http://127.0.0.1:1";

/// The fake host is told where to log through the environment, and the
/// environment is per-process, not per-test. Cargo runs integration tests in
/// threads of one process, so these two have to take turns: without this they
/// read each other's log.
static SERIAL: Mutex<()> = Mutex::new(());

fn take_turn() -> MutexGuard<'static, ()> {
    SERIAL.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn log_path(name: &str) -> std::path::PathBuf {
    let path = std::env::temp_dir().join(format!("pane-host-{name}-{}.log", std::process::id()));
    let _ = std::fs::remove_file(&path);
    path
}

fn config(log: &std::path::Path) -> HostConfig {
    std::env::set_var("FAKE_PANE_HOST_LOG", log);
    HostConfig {
        binary: Some(env!("CARGO_BIN_EXE_fake-pane-host").to_string()),
        local_node: Some(NO_NODE.to_string()),
        tenant: None,
        bearer: None,
    }
}

/// Wait for the fake host's log to satisfy `done`, or give up.
fn wait_for(log: &std::path::Path, done: impl Fn(&str) -> bool) -> String {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
        let contents = std::fs::read_to_string(log).unwrap_or_default();
        if done(&contents) {
            return contents;
        }
        if Instant::now() > deadline {
            return contents;
        }
        std::thread::sleep(Duration::from_millis(25));
    }
}

#[test]
fn killing_the_host_restarts_it_and_re_creates_every_open_pane() {
    let _turn = take_turn();
    let log = log_path("restart");
    let app = tauri::test::mock_app();
    let supervisor = Supervisor::new(
        app.handle().clone(),
        ParentSurface::AppKit { ns_view: 0x1000 },
        config(&log),
    );
    supervisor.start().expect("the fake host starts");

    let canonical = supervisor
        .create("pane-1", "https://example.com/one", Bounds::new(0, 0, 800, 600))
        .expect("the pane is created");
    assert_eq!(canonical, "https://example.com/one");

    let opened = wait_for(&log, |contents| contents.contains("create "));
    assert_eq!(opened.lines().filter(|line| line.starts_with("create ")).count(), 1);

    // The engine dies. The chrome must stay usable and the pane must come back.
    supervisor.restart().expect("the host is killed");
    let restored = wait_for(&log, |contents| {
        contents.lines().filter(|line| line.starts_with("create ")).count() >= 2
    });

    let creates: Vec<&str> = restored
        .lines()
        .filter(|line| line.starts_with("create "))
        .collect();
    assert_eq!(creates.len(), 2, "the pane was re-created after the restart");
    assert!(
        creates[1].contains("https://example.com/one"),
        "restored at its last URL, got {:?}",
        creates[1]
    );
    assert!(
        creates[1].contains("800x600"),
        "restored with the geometry the chrome measured, got {:?}",
        creates[1]
    );

    // And the chrome is still able to drive it.
    supervisor
        .navigate("pane-1", "https://example.com/two")
        .expect("the restarted host serves requests");

    supervisor.shutdown();
}

#[test]
fn a_pane_closed_before_the_crash_is_not_resurrected() {
    let _turn = take_turn();
    let log = log_path("closed");
    let app = tauri::test::mock_app();
    let supervisor = Supervisor::new(
        app.handle().clone(),
        ParentSurface::AppKit { ns_view: 0x1000 },
        config(&log),
    );
    supervisor.start().expect("the fake host starts");

    supervisor
        .create("pane-2", "https://example.com/gone", Bounds::new(0, 0, 400, 300))
        .expect("created");
    supervisor.close("pane-2").expect("closed");
    wait_for(&log, |contents| contents.contains("close "));

    supervisor.restart().expect("the host is killed");
    // Nothing to re-create, so wait for the window in which it would have.
    std::thread::sleep(Duration::from_millis(1500));

    let contents = std::fs::read_to_string(&log).unwrap_or_default();
    assert_eq!(
        contents.lines().filter(|line| line.starts_with("create ")).count(),
        1,
        "a closed pane stays closed across a restart"
    );

    supervisor.shutdown();
}
