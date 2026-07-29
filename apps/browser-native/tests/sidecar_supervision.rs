//! Integration: GPUI sidecar supervision against fake-pane-host (SPEC B5).

#![cfg(feature = "servo-pane")]

use std::path::PathBuf;
use std::thread;
use std::time::Duration;

use browser_native::surfaces::sidecar::{pane_id, PaneHostSupervisor, SidecarConfig};
use pane_protocol::{Bounds, ParentSurface};

fn fake_host_bin() -> PathBuf {
    PathBuf::from(env!("CARGO_BIN_EXE_fake-pane-host"))
}

#[test]
fn gpui_sidecar_spawns_restarts_and_reseeds_open_panes() {
    let log = tempfile::NamedTempFile::new().expect("log file");
    let log_path = log.path().to_path_buf();

    let config = SidecarConfig {
        binary: fake_host_bin().to_string_lossy().into_owned(),
        local_node: None,
        tenant: None,
        bearer: None,
    };
    // Inject log path via wrapping env on the child — set on the supervisor
    // process so Command inherits it when we set it before start.
    std::env::set_var("FAKE_PANE_HOST_LOG", &log_path);

    let supervisor = PaneHostSupervisor::new(config, ParentSurface::AppKit { ns_view: 0xabc });
    supervisor.start().expect("start fake host");
    assert!(supervisor.is_running());

    let pane = supervisor
        .create(
            "servo-1",
            "https://example.com/",
            Bounds::new(10, 20, 800, 600),
        )
        .expect("create pane");
    assert_eq!(pane, pane_id("servo-1"));

    // Navigate so the graph snapshot advances; create already recorded the URL.
    supervisor.record_graph_url(pane, "https://example.com/final");

    // Kill the child; the reader thread should restart and reseed.
    {
        // Access through restart(): kill running child, reader respawns.
        supervisor.restart().expect("restart signal");
    }

    let deadline = std::time::Instant::now() + Duration::from_secs(3);
    while supervisor.restart_count() == 0 && std::time::Instant::now() < deadline {
        thread::sleep(Duration::from_millis(50));
    }
    assert!(
        supervisor.restart_count() >= 1,
        "expected automatic restart after kill"
    );
    assert!(supervisor.is_running());

    // Give reseed Create a moment to land in the log.
    thread::sleep(Duration::from_millis(200));
    let body = std::fs::read_to_string(&log_path).expect("read log");
    let create_frames = body
        .lines()
        .filter(|line| line.starts_with("create "))
        .collect::<Vec<_>>();
    assert!(
        create_frames.len() >= 2,
        "expected initial and reseed create frames, got:\n{body}"
    );
    assert!(
        create_frames
            .last()
            .is_some_and(|line| line.contains("https://example.com/final")),
        "expected final graph URL in reseed frame, got:\n{body}"
    );

    supervisor.stop();
    std::env::remove_var("FAKE_PANE_HOST_LOG");
}
