//! GPUI-edition pane-host sidecar supervision (SPEC B5).
//!
//! The Tauri edition already owns `tauri-plugin-servo-panes`. This module is the
//! same contract for `apps/browser-native`: spawn the out-of-process host, notice
//! death, restart, and reseed open panes from the chrome's session snapshot.
//!
//! Theorem `browser-embed` bounds x/y, IME, and SceneOS producer gaps remain
//! upstream blockers; this only closes the CommonPlace-owned supervision seam.

use std::collections::{BTreeMap, HashMap};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use pane_protocol::{
    read_frame, write_frame, Bounds, Envelope, Outbound, PaneId, ParentSurface, Request, Response,
    ResponseValue,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const RESTART_BACKOFF: Duration = Duration::from_millis(100);

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PaneSnapshot {
    pub key: String,
    pub url: String,
    pub bounds: Bounds,
    pub attention: bool,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Reseed {
    pub pane: PaneId,
    pub url: String,
    pub bounds: Bounds,
    pub attention: bool,
}

#[derive(Clone, Debug, Default)]
pub struct SidecarConfig {
    /// Absolute path to the pane-host (or fake-pane-host) binary.
    pub binary: String,
    pub local_node: Option<String>,
    pub tenant: Option<String>,
    pub bearer: Option<String>,
}

/// Stable chrome pane key → PaneId (FNV-1a; never zero).
pub fn pane_id(key: &str) -> PaneId {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in key.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x1000_0000_01b3);
    }
    PaneId(hash | 1)
}

/// GRAPH owns URL; CHROME owns geometry and attention.
pub fn reseed_plan(
    restored_urls: &BTreeMap<PaneId, String>,
    open: &[(PaneId, PaneSnapshot)],
) -> Vec<Reseed> {
    open.iter()
        .map(|(pane, record)| Reseed {
            pane: *pane,
            url: match restored_urls.get(pane) {
                Some(url) if !url.is_empty() => url.clone(),
                _ => record.url.clone(),
            },
            bounds: record.bounds,
            attention: record.attention,
        })
        .collect()
}

/// GPUI-free supervisor for the pane-host child process.
pub struct PaneHostSupervisor {
    config: SidecarConfig,
    parent: ParentSurface,
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, Sender<Response>>>,
    panes: Mutex<BTreeMap<PaneId, PaneSnapshot>>,
    /// Last-known URLs from the session graph (chrome-side snapshot).
    graph_urls: Mutex<BTreeMap<PaneId, String>>,
    stopping: AtomicBool,
    restart_count: AtomicU64,
}

impl PaneHostSupervisor {
    pub fn new(config: SidecarConfig, parent: ParentSurface) -> Arc<Self> {
        Arc::new(Self {
            config,
            parent,
            child: Mutex::new(None),
            stdin: Mutex::new(None),
            next_id: AtomicU64::new(1),
            pending: Mutex::new(HashMap::new()),
            panes: Mutex::new(BTreeMap::new()),
            graph_urls: Mutex::new(BTreeMap::new()),
            stopping: AtomicBool::new(false),
            restart_count: AtomicU64::new(0),
        })
    }

    pub fn restart_count(&self) -> u64 {
        self.restart_count.load(Ordering::SeqCst)
    }

    pub fn is_running(&self) -> bool {
        self.child.lock().unwrap().is_some()
    }

    pub fn record_graph_url(&self, pane: PaneId, url: impl Into<String>) {
        self.graph_urls.lock().unwrap().insert(pane, url.into());
    }

    pub fn start(self: &Arc<Self>) -> Result<(), String> {
        let mut command = Command::new(&self.config.binary);
        command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit());
        if let Some(node) = &self.config.local_node {
            command.env("THEOREM_LOCAL_NODE", node);
        }
        if let Some(tenant) = &self.config.tenant {
            command.env("THEOREM_TENANT", tenant);
        }
        if let Some(bearer) = &self.config.bearer {
            command.env("THEOREM_HARNESS_TOKEN", bearer);
        }
        if let Ok(log) = std::env::var("FAKE_PANE_HOST_LOG") {
            command.env("FAKE_PANE_HOST_LOG", log);
        }

        let mut child = command
            .spawn()
            .map_err(|error| format!("could not start pane host: {error}"))?;
        let stdout = child.stdout.take().ok_or("pane host has no stdout")?;
        *self.stdin.lock().unwrap() = child.stdin.take();
        *self.child.lock().unwrap() = Some(child);

        let supervisor = Arc::clone(self);
        std::thread::spawn(move || {
            let mut reader = stdout;
            loop {
                match read_frame::<_, Outbound>(&mut reader) {
                    Ok(Outbound::Response(response)) => supervisor.settle(response),
                    Ok(Outbound::Event(_)) => {}
                    Err(_) => break,
                }
            }
            supervisor.on_host_gone();
        });
        Ok(())
    }

    pub fn stop(self: &Arc<Self>) {
        self.stopping.store(true, Ordering::SeqCst);
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        *self.stdin.lock().unwrap() = None;
        self.pending.lock().unwrap().clear();
    }

    /// Kill a running host (reader path restarts) or start when none is alive.
    pub fn restart(self: &Arc<Self>) -> Result<(), String> {
        let running = {
            let mut child = self.child.lock().unwrap();
            match child.as_mut() {
                Some(child) => {
                    let _ = child.kill();
                    true
                }
                None => false,
            }
        };
        if running {
            return Ok(());
        }
        self.stopping.store(false, Ordering::SeqCst);
        self.start()?;
        self.reseed();
        Ok(())
    }

    pub fn create(
        self: &Arc<Self>,
        key: &str,
        url: &str,
        bounds: Bounds,
    ) -> Result<PaneId, String> {
        let pane = pane_id(key);
        self.panes.lock().unwrap().insert(
            pane,
            PaneSnapshot {
                key: key.to_string(),
                url: url.to_string(),
                bounds,
                attention: false,
            },
        );
        self.record_graph_url(pane, url);
        self.request(Request::Create {
            pane,
            parent: self.parent,
            bounds,
            url: url.to_string(),
        })?;
        Ok(pane)
    }

    pub fn request(self: &Arc<Self>, request: Request) -> Result<ResponseValue, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (sender, receiver) = channel();
        self.pending.lock().unwrap().insert(id, sender);

        {
            let mut stdin = self.stdin.lock().unwrap();
            let Some(pipe) = stdin.as_mut() else {
                self.pending.lock().unwrap().remove(&id);
                return Err("the pane host is not running".into());
            };
            if let Err(error) = write_frame(pipe, &Envelope { id, request }) {
                self.pending.lock().unwrap().remove(&id);
                return Err(format!("could not reach the pane host: {error}"));
            }
        }

        match receiver.recv_timeout(REQUEST_TIMEOUT) {
            Ok(response) => response.result.map_err(|error| error.message),
            Err(_) => {
                self.pending.lock().unwrap().remove(&id);
                Err("the pane host did not answer".into())
            }
        }
    }

    fn settle(&self, response: Response) {
        if let Some(sender) = self.pending.lock().unwrap().remove(&response.id) {
            let _ = sender.send(response);
        }
    }

    fn on_host_gone(self: &Arc<Self>) {
        self.pending.lock().unwrap().clear();
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.wait();
        }
        *self.stdin.lock().unwrap() = None;
        if self.stopping.load(Ordering::SeqCst) {
            return;
        }

        std::thread::sleep(RESTART_BACKOFF);
        if let Err(error) = self.start() {
            eprintln!("[browser-native] could not restart pane host: {error}");
            return;
        }
        self.restart_count.fetch_add(1, Ordering::SeqCst);
        self.reseed();
    }

    fn reseed(self: &Arc<Self>) {
        let restored = self.graph_urls.lock().unwrap().clone();
        let open: Vec<(PaneId, PaneSnapshot)> = self
            .panes
            .lock()
            .unwrap()
            .iter()
            .map(|(pane, record)| (*pane, record.clone()))
            .collect();
        for step in reseed_plan(&restored, &open) {
            let _ = self.request(Request::Create {
                pane: step.pane,
                parent: self.parent,
                bounds: step.bounds,
                url: step.url,
            });
            if step.attention {
                let _ = self.request(Request::SetAttention {
                    pane: step.pane,
                    on: true,
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chrome_pane_ids_are_stable_and_nonzero() {
        assert_eq!(pane_id("pane-7"), pane_id("pane-7"));
        assert_ne!(pane_id("pane-7"), pane_id("pane-8"));
        assert_ne!(pane_id("pane-0"), PaneId::default());
    }

    #[test]
    fn reseed_prefers_graph_url_over_stale_chrome_url() {
        let one = pane_id("pane-1");
        let restored = BTreeMap::from([(one, "https://last.example/".into())]);
        let open = vec![(
            one,
            PaneSnapshot {
                key: "pane-1".into(),
                url: "https://stale.example/".into(),
                bounds: Bounds::new(0, 0, 800, 600),
                attention: false,
            },
        )];
        let plan = reseed_plan(&restored, &open);
        assert_eq!(plan[0].url, "https://last.example/");
    }

    #[test]
    fn closed_chrome_panes_are_not_resurrected() {
        let closed = pane_id("pane-4");
        let restored = BTreeMap::from([(closed, "https://gone.example/".into())]);
        assert!(reseed_plan(&restored, &[]).is_empty());
    }
}
