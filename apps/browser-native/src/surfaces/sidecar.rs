//! GPUI-edition pane-host sidecar supervision (SPEC B5).
//!
//! The Tauri edition already owns `tauri-plugin-servo-panes`. This module is the
//! same contract for `apps/browser-native`: spawn the out-of-process host, notice
//! death, restart, and reseed open panes from the chrome's session snapshot.
//!
//! Theorem `browser-embed` bounds x/y, IME, and SceneOS producer gaps remain
//! upstream blockers; this only closes the CommonPlace-owned supervision seam.

use std::collections::{BTreeMap, HashMap, VecDeque};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use pane_protocol::{
    read_frame, write_frame, Bounds, Envelope, Outbound, PaneEvent, PaneId, ParentSurface, Request,
    Response, ResponseValue,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const RESTART_BACKOFF: Duration = Duration::from_millis(100);
const MAX_RESTART_BACKOFF: Duration = Duration::from_secs(5);
const MAX_CONSECUTIVE_RESTARTS: u64 = 5;

fn restart_backoff(attempt: u64) -> Duration {
    RESTART_BACKOFF
        .saturating_mul(1_u32 << attempt.min(6))
        .min(MAX_RESTART_BACKOFF)
}

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
    events: Mutex<VecDeque<PaneEvent>>,
    stopping: AtomicBool,
    consecutive_restarts: AtomicU64,
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
            events: Mutex::new(VecDeque::new()),
            stopping: AtomicBool::new(false),
            consecutive_restarts: AtomicU64::new(0),
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

    /// Drain sidecar events for the native chrome event loop.
    pub fn drain_events(&self) -> Vec<PaneEvent> {
        self.events.lock().unwrap().drain(..).collect()
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
                    Ok(Outbound::Event(event)) => supervisor.handle_event(event),
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
        self.consecutive_restarts.store(0, Ordering::SeqCst);
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
        self.request(Request::Create {
            pane,
            parent: self.parent,
            bounds,
            url: url.to_string(),
        })?;
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
        self.consecutive_restarts.store(0, Ordering::SeqCst);
        if let Some(sender) = self.pending.lock().unwrap().remove(&response.id) {
            let _ = sender.send(response);
        }
    }

    fn handle_event(&self, event: PaneEvent) {
        self.consecutive_restarts.store(0, Ordering::SeqCst);
        if let PaneEvent::UrlChanged { pane, url } | PaneEvent::LoadStable { pane, url } = &event {
            self.record_graph_url(*pane, url);
            if let Some(snapshot) = self.panes.lock().unwrap().get_mut(pane) {
                snapshot.url.clone_from(url);
            }
        }
        self.events.lock().unwrap().push_back(event);
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

        let attempt = self.consecutive_restarts.load(Ordering::SeqCst);
        if attempt >= MAX_CONSECUTIVE_RESTARTS {
            eprintln!(
                "[browser-native] pane host exited {attempt} consecutive times; automatic restart stopped"
            );
            return;
        }
        std::thread::sleep(restart_backoff(attempt));
        if let Err(error) = self.start() {
            eprintln!("[browser-native] could not restart pane host: {error}");
            return;
        }
        self.consecutive_restarts.fetch_add(1, Ordering::SeqCst);
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

    #[test]
    fn restart_backoff_grows_and_caps() {
        assert_eq!(restart_backoff(0), Duration::from_millis(100));
        assert_eq!(restart_backoff(1), Duration::from_millis(200));
        assert_eq!(restart_backoff(20), MAX_RESTART_BACKOFF);
    }

    #[test]
    fn failed_create_is_not_saved_for_reseed() {
        let supervisor =
            PaneHostSupervisor::new(SidecarConfig::default(), ParentSurface::Win32 { hwnd: 1 });
        assert!(supervisor
            .create(
                "rejected",
                "https://example.com/",
                Bounds::new(0, 0, 800, 600),
            )
            .is_err());
        assert!(supervisor.panes.lock().unwrap().is_empty());
        assert!(supervisor.graph_urls.lock().unwrap().is_empty());
    }

    #[test]
    fn navigation_events_update_reseed_url_and_remain_observable() {
        let supervisor =
            PaneHostSupervisor::new(SidecarConfig::default(), ParentSurface::Win32 { hwnd: 1 });
        let pane = pane_id("changed");
        supervisor.panes.lock().unwrap().insert(
            pane,
            PaneSnapshot {
                key: "changed".into(),
                url: "https://old.example/".into(),
                bounds: Bounds::new(0, 0, 800, 600),
                attention: false,
            },
        );
        supervisor.handle_event(PaneEvent::UrlChanged {
            pane,
            url: "https://new.example/".into(),
        });

        assert_eq!(
            supervisor
                .graph_urls
                .lock()
                .unwrap()
                .get(&pane)
                .map(String::as_str),
            Some("https://new.example/")
        );
        assert!(matches!(
            supervisor.drain_events().as_slice(),
            [PaneEvent::UrlChanged { url, .. }] if url == "https://new.example/"
        ));
    }
}
