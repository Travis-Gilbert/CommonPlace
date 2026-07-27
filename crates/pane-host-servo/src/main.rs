//! SPEC-COMMONPLACE-BROWSER-SHELL B2 — the `pane-host` sidecar.
//!
//! One process, one Servo engine, N panes, speaking `pane-protocol` over stdin
//! and stdout. It is spawned and supervised by
//! `tauri-plugin-servo-panes`; if it dies, the supervisor restarts it and
//! re-creates panes from the session graph, which is why nothing here tries to
//! recover from anything. Dying loudly is the contract.
//!
//! stdout is the wire. Anything that wants to say something to a human writes
//! to stderr, which the supervisor captures.

mod servo_engine;

use std::sync::mpsc::channel;
use std::thread;

use pane_host::server::{read_requests, run};
use pane_host::{Host, LocalNode, SessionGraph};

use crate::servo_engine::ServoEngine;

fn main() {
    let (sender, receiver) = channel();
    // A dedicated thread owns the blocking read so the engine keeps spinning
    // while the chrome has nothing to say.
    thread::spawn(move || read_requests(std::io::stdin().lock(), sender));

    let mut host = Host::new(ServoEngine::new(), SessionGraph::new(LocalNode::from_env()));
    let mut out = std::io::stdout().lock();
    if let Err(error) = run(&mut host, &receiver, &mut out) {
        eprintln!("[pane-host] the wire failed: {error}");
        std::process::exit(1);
    }
}
