//! The sidecar supervisor.
//!
//! It owns the `pane-host` child process, correlates requests to responses,
//! forwards events to the chrome, and — the part that matters — brings the
//! child back when it dies.
//!
//! A crashed engine must not take the chrome with it. That is the entire point
//! of running Servo out of process, so the failure path is the designed path:
//! the reader thread sees EOF, the supervisor spawns a new host, and every pane
//! the chrome still has open is re-created at the URL the session graph says it
//! was last on.

use std::collections::{BTreeMap, HashMap};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use pane_host::{LocalNode, SessionGraph};
use pane_protocol::{
    read_frame, write_frame, Bounds, Envelope, Outbound, PaneEvent, PaneId, ParentSurface, Request,
    Response, ResponseValue,
};
use serde_json::json;
use tauri::{AppHandle, Emitter, Runtime};

/// How long a command waits for the host to answer. Generous, because the
/// answer may be behind a page load; finite, because a wedged host must surface
/// as an error rather than a spinner that never stops.
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// Pause before respawning a dead host. A host that crashes on startup would
/// otherwise spin the CPU restarting forever.
const RESTART_BACKOFF: Duration = Duration::from_millis(500);

/// Where the local RustyRed node and its credentials are, and where the sidecar
/// binary is. Supplied by the host application because the bearer lives in the
/// OS keychain, which this crate has no business reaching into.
#[derive(Clone, Debug, Default)]
pub struct HostConfig {
    pub binary: Option<String>,
    pub local_node: Option<String>,
    pub tenant: Option<String>,
    pub bearer: Option<String>,
}

/// Where a pane is in its load cycle, as the HOST reports it. Matches the
/// `PaneLifecycle` union in `apps/console/src/lib/pane-bridge.ts`.
#[derive(Clone, Copy, Debug, Eq, PartialEq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Lifecycle {
    Loading,
    Ready,
    Crashed,
}

#[derive(Clone, Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaneStatus {
    pub pane_id: String,
    pub url: String,
    pub title: String,
    pub attention: bool,
    pub state: Lifecycle,
}

#[derive(Clone, Debug)]
struct PaneRecord {
    key: String,
    url: String,
    title: String,
    attention: bool,
    state: Lifecycle,
    bounds: Bounds,
    created_at: u64,
}

pub struct Supervisor<R: Runtime> {
    app: AppHandle<R>,
    config: HostConfig,
    /// Captured once, on the main thread, at plugin setup. A pane is always
    /// parented into the one chrome window, and fetching a window handle off
    /// the main thread is not something every platform tolerates.
    parent: ParentSurface,
    child: Mutex<Option<Child>>,
    stdin: Mutex<Option<ChildStdin>>,
    next_id: AtomicU64,
    pending: Mutex<HashMap<u64, Sender<Response>>>,
    panes: Mutex<BTreeMap<PaneId, PaneRecord>>,
    graph: Mutex<SessionGraph<LocalNode>>,
    /// Set while the supervisor is deliberately taking the host down, so the
    /// reader thread does not read a clean shutdown as a crash.
    stopping: AtomicBool,
}

impl<R: Runtime> Supervisor<R> {
    pub fn new(app: AppHandle<R>, parent: ParentSurface, config: HostConfig) -> Arc<Self> {
        let graph = SessionGraph::new(LocalNode::new(
            config
                .local_node
                .clone()
                .unwrap_or_else(|| pane_host::session::DEFAULT_LOCAL_NODE.to_string()),
            config.tenant.clone(),
            config.bearer.clone(),
        ));
        Arc::new(Self {
            app,
            config,
            parent,
            child: Mutex::new(None),
            stdin: Mutex::new(None),
            next_id: AtomicU64::new(1),
            pending: Mutex::new(HashMap::new()),
            panes: Mutex::new(BTreeMap::new()),
            graph: Mutex::new(graph),
            stopping: AtomicBool::new(false),
        })
    }

    /// Numeric pane id derived from the chrome's string id.
    ///
    /// A hash rather than a counter, so the mapping survives an application
    /// restart with no state at all: the chrome hands back `pane-7` and it lands
    /// on the same `PaneId` and therefore the same session-graph nodes it did
    /// yesterday. FNV-1a because it is four lines and this is not a security
    /// boundary.
    pub fn pane_id(key: &str) -> PaneId {
        let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
        for byte in key.as_bytes() {
            hash ^= *byte as u64;
            hash = hash.wrapping_mul(0x1000_0000_01b3);
        }
        // Zero is reserved so a default-constructed PaneId is never a real pane.
        PaneId(hash | 1)
    }

    pub fn start(self: &Arc<Self>) -> Result<(), String> {
        let binary = match &self.config.binary {
            Some(path) => path.clone(),
            None => sibling_binary()?,
        };
        let mut command = Command::new(&binary);
        command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::inherit());
        if let Some(node) = &self.config.local_node {
            command.env("THEOREM_LOCAL_NODE", node);
        }
        if let Some(tenant) = &self.config.tenant {
            command.env("THEOREM_TENANT", tenant);
        }
        if let Some(bearer) = &self.config.bearer {
            command.env("THEOREM_HARNESS_TOKEN", bearer);
        }

        let mut child = command
            .spawn()
            .map_err(|error| format!("could not start the pane host at {binary}: {error}"))?;
        let stdout = child.stdout.take().ok_or("the pane host has no stdout")?;
        *self.stdin.lock().unwrap() = child.stdin.take();
        *self.child.lock().unwrap() = Some(child);

        let supervisor = Arc::clone(self);
        std::thread::spawn(move || {
            let mut reader = stdout;
            loop {
                match read_frame::<_, Outbound>(&mut reader) {
                    Ok(Outbound::Response(response)) => supervisor.settle(response),
                    Ok(Outbound::Event(event)) => supervisor.on_event(event),
                    Err(_) => break,
                }
            }
            supervisor.on_host_gone();
        });
        Ok(())
    }

    /// Take the host down and bring it back.
    ///
    /// When a host is running, killing it is enough: the reader thread sees EOF
    /// and the restart path takes over. When there is none — the sidecar was
    /// missing at startup, or it failed to respawn — this is the chrome's way
    /// back, which is why `paneHostRestart()` exists in the bridge.
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

    fn on_host_gone(self: &Arc<Self>) {
        // Every in-flight request is now unanswerable. Dropping the senders
        // wakes each caller with a disconnect rather than leaving it to time
        // out fifteen seconds later.
        self.pending.lock().unwrap().clear();
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.wait();
        }
        *self.stdin.lock().unwrap() = None;
        for record in self.panes.lock().unwrap().values_mut() {
            record.state = Lifecycle::Crashed;
        }
        if self.stopping.load(Ordering::SeqCst) {
            return;
        }

        std::thread::sleep(RESTART_BACKOFF);
        if let Err(error) = self.start() {
            eprintln!("[servo-panes] could not restart the pane host: {error}");
            return;
        }
        self.reseed();
    }

    /// Re-create every pane the chrome still has open, at the URL the session
    /// graph says it was last on.
    fn reseed(self: &Arc<Self>) {
        let restored: BTreeMap<PaneId, String> = match self.graph.lock().unwrap().open_panes() {
            Ok(panes) => panes
                .into_iter()
                .map(|pane| (pane.pane, pane.url))
                .collect(),
            Err(error) => {
                eprintln!("[servo-panes] could not read the session graph: {error}");
                BTreeMap::new()
            }
        };

        let open: Vec<(PaneId, PaneRecord)> = self
            .panes
            .lock()
            .unwrap()
            .iter()
            .map(|(pane, record)| (*pane, record.clone()))
            .collect();

        for step in reseed_plan(&restored, &open) {
            let outcome = self.request(Request::Create {
                pane: step.pane,
                parent: self.parent,
                bounds: step.bounds,
                url: step.url.clone(),
            });
            match outcome {
                Ok(_) => {
                    {
                        let mut panes = self.panes.lock().unwrap();
                        if let Some(record) = panes.get_mut(&step.pane) {
                            record.url = step.url;
                            record.state = Lifecycle::Loading;
                        }
                    }
                    // Attention is per-pane HOST state and did not survive the
                    // host, so the chip and the engine have to be put back in
                    // agreement explicitly.
                    if step.attention {
                        let _ = self.request(Request::SetAttention {
                            pane: step.pane,
                            on: true,
                        });
                    }
                }
                Err(error) => eprintln!("[servo-panes] could not restore {}: {error}", step.pane),
            }
        }
    }

    fn settle(&self, response: Response) {
        if let Some(sender) = self.pending.lock().unwrap().remove(&response.id) {
            let _ = sender.send(response);
        }
    }

    /// Send a request and wait for its answer.
    pub fn request(&self, request: Request) -> Result<ResponseValue, String> {
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        let (sender, receiver) = channel();
        self.pending.lock().unwrap().insert(id, sender);

        {
            let mut stdin = self.stdin.lock().unwrap();
            let Some(pipe) = stdin.as_mut() else {
                self.pending.lock().unwrap().remove(&id);
                return Err("the pane host is not running".to_string());
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
                Err("the pane host did not answer".to_string())
            }
        }
    }

    pub fn create(&self, key: &str, url: &str, bounds: Bounds) -> Result<String, String> {
        let pane = Self::pane_id(key);
        let created_at = now_ms();
        self.panes.lock().unwrap().insert(
            pane,
            PaneRecord {
                key: key.to_string(),
                url: url.to_string(),
                title: String::new(),
                attention: false,
                state: Lifecycle::Loading,
                bounds,
                created_at,
            },
        );

        let canonical = match self.request(Request::Create {
            pane,
            parent: self.parent,
            bounds,
            url: url.to_string(),
        }) {
            Ok(ResponseValue::Navigating { canonical_url }) => canonical_url,
            Ok(other) => return Err(format!("the pane host answered {other:?}")),
            Err(error) => {
                self.panes.lock().unwrap().remove(&pane);
                return Err(error);
            }
        };

        if let Some(record) = self.panes.lock().unwrap().get_mut(&pane) {
            record.url = canonical.clone();
        }
        // B3. The chrome owns pane lifecycle, so the `Pane` node is written
        // here; the host writes the visits.
        if let Err(error) = self.graph.lock().unwrap().open_pane(pane, key, created_at) {
            eprintln!("[servo-panes] {error}");
        }
        Ok(canonical)
    }

    pub fn close(&self, key: &str) -> Result<(), String> {
        let pane = Self::pane_id(key);
        let record = self.panes.lock().unwrap().remove(&pane);
        let outcome = self.request(Request::Close { pane }).map(|_| ());
        if let Some(record) = record {
            if let Err(error) =
                self.graph
                    .lock()
                    .unwrap()
                    .close_pane(pane, &record.key, record.created_at, now_ms())
            {
                eprintln!("[servo-panes] {error}");
            }
        }
        outcome
    }

    pub fn navigate(&self, key: &str, url: &str) -> Result<String, String> {
        let pane = Self::pane_id(key);
        match self.request(Request::Navigate {
            pane,
            url: url.to_string(),
        })? {
            ResponseValue::Navigating { canonical_url } => Ok(canonical_url),
            other => Err(format!("the pane host answered {other:?}")),
        }
    }

    pub fn set_bounds(&self, key: &str, bounds: Bounds) -> Result<(), String> {
        let pane = Self::pane_id(key);
        if let Some(record) = self.panes.lock().unwrap().get_mut(&pane) {
            // Remembered so a restarted host can be handed the same geometry.
            record.bounds = bounds;
        }
        self.request(Request::SetBounds { pane, bounds }).map(|_| ())
    }

    pub fn simple(&self, request: Request) -> Result<(), String> {
        self.request(request).map(|_| ())
    }

    pub fn status(&self, key: &str) -> Result<PaneStatus, String> {
        let pane = Self::pane_id(key);
        self.panes
            .lock()
            .unwrap()
            .get(&pane)
            .map(|record| PaneStatus {
                pane_id: record.key.clone(),
                url: record.url.clone(),
                title: record.title.clone(),
                attention: record.attention,
                state: record.state,
            })
            .ok_or_else(|| format!("no open pane {key}"))
    }

    /// Update the plugin's view of a pane and hand the event to the chrome.
    ///
    /// The `pane` field is rewritten from the numeric `PaneId` to the string the
    /// chrome named it with: `panePayloadId` in `pane-bridge.ts` keys its
    /// runtime map on exactly that, and a number would key a different entry.
    fn on_event(&self, event: PaneEvent) {
        let pane = event.pane();
        let key = {
            let mut panes = self.panes.lock().unwrap();
            let Some(record) = panes.get_mut(&pane) else {
                return;
            };
            match &event {
                PaneEvent::LoadStart { .. } => record.state = Lifecycle::Loading,
                PaneEvent::LoadStable { url, .. } => {
                    record.state = Lifecycle::Ready;
                    record.url = url.clone();
                }
                PaneEvent::UrlChanged { url, .. } => record.url = url.clone(),
                PaneEvent::TitleChanged { title, .. } => record.title = title.clone(),
                PaneEvent::Crashed { .. } => record.state = Lifecycle::Crashed,
                PaneEvent::AttentionChanged { on, .. } => record.attention = *on,
                PaneEvent::NavigationRefused { .. } | PaneEvent::AttentionSpan { .. } => {}
            }
            record.key.clone()
        };

        let payload = match &event {
            PaneEvent::LoadStart { url, .. }
            | PaneEvent::LoadStable { url, .. }
            | PaneEvent::UrlChanged { url, .. } => json!({ "pane": key, "url": url }),
            PaneEvent::TitleChanged { title, .. } => json!({ "pane": key, "title": title }),
            PaneEvent::Crashed { reason, .. } => json!({ "pane": key, "reason": reason }),
            PaneEvent::NavigationRefused { url, error, .. } => json!({
                "pane": key,
                "url": url,
                "error": { "kind": error.kind, "message": error.message },
            }),
            PaneEvent::AttentionSpan { url, spans, sequence, .. } => json!({
                "pane": key,
                "url": url,
                "spans": spans,
                "sequence": sequence,
            }),
            PaneEvent::AttentionChanged { on, .. } => json!({ "pane": key, "on": on }),
        };

        if let Err(error) = self.app.emit(event.event_name(), payload) {
            eprintln!("[servo-panes] could not forward {}: {error}", event.event_name());
        }
    }

    /// Stop the host without restarting it. Called when the application quits.
    pub fn shutdown(&self) {
        self.stopping.store(true, Ordering::SeqCst);
        *self.stdin.lock().unwrap() = None;
        if let Some(child) = self.child.lock().unwrap().as_mut() {
            let _ = child.kill();
        }
    }
}

/// One pane to re-create after the host came back.
#[derive(Clone, Debug, Eq, PartialEq)]
struct Reseed {
    pane: PaneId,
    url: String,
    bounds: Bounds,
    attention: bool,
}

/// Decide what a restarted host should be asked to re-create.
///
/// Split out from [`Supervisor::reseed`] because it is the whole acceptance
/// criterion — every open pane returns to its last URL from the session graph —
/// and the process mechanics around it cannot be exercised without a real
/// child process.
///
/// The division of authority: the GRAPH owns the URL, because it is the only
/// thing that recorded where the page ended up; the CHROME owns the geometry
/// and the attention chip, because the graph never knew either. A pane whose
/// graph entry has no URL yet (created, never settled) falls back to what the
/// chrome asked for, which is better than opening a blank pane.
fn reseed_plan(restored: &BTreeMap<PaneId, String>, open: &[(PaneId, PaneRecord)]) -> Vec<Reseed> {
    open.iter()
        .map(|(pane, record)| Reseed {
            pane: *pane,
            url: match restored.get(pane) {
                Some(url) if !url.is_empty() => url.clone(),
                _ => record.url.clone(),
            },
            bounds: record.bounds,
            attention: record.attention,
        })
        .collect()
}

/// The sidecar ships beside the application binary, which is where Tauri puts
/// it. An explicit path in `HostConfig` wins, for development runs where the
/// two are built into different target directories.
fn sibling_binary() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|error| error.to_string())?;
    let directory = exe
        .parent()
        .ok_or("the application binary has no directory")?;
    Ok(directory
        .join(if cfg!(windows) { "pane-host.exe" } else { "pane-host" })
        .to_string_lossy()
        .to_string())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_chrome_pane_id_maps_to_the_same_number_every_time() {
        assert_eq!(
            Supervisor::<tauri::Wry>::pane_id("pane-7"),
            Supervisor::<tauri::Wry>::pane_id("pane-7")
        );
        assert_ne!(
            Supervisor::<tauri::Wry>::pane_id("pane-7"),
            Supervisor::<tauri::Wry>::pane_id("pane-8")
        );
    }

    #[test]
    fn no_pane_is_ever_the_default_id() {
        for key in ["", "pane-0", "pane-1", "a", "b"] {
            assert_ne!(Supervisor::<tauri::Wry>::pane_id(key), PaneId::default());
        }
    }

    fn record(key: &str, url: &str, attention: bool) -> PaneRecord {
        PaneRecord {
            key: key.to_string(),
            url: url.to_string(),
            title: String::new(),
            attention,
            state: Lifecycle::Crashed,
            bounds: Bounds::new(4, 8, 800, 600),
            created_at: 1,
        }
    }

    #[test]
    fn every_open_pane_returns_to_its_last_url_from_the_session_graph() {
        let one = Supervisor::<tauri::Wry>::pane_id("pane-1");
        let two = Supervisor::<tauri::Wry>::pane_id("pane-2");
        let restored = BTreeMap::from([
            (one, "https://last.example/one".to_string()),
            (two, "https://last.example/two".to_string()),
        ]);
        let open = vec![
            (one, record("pane-1", "https://stale.example/one", false)),
            (two, record("pane-2", "https://stale.example/two", true)),
        ];

        assert_eq!(
            reseed_plan(&restored, &open),
            vec![
                Reseed {
                    pane: one,
                    url: "https://last.example/one".to_string(),
                    bounds: Bounds::new(4, 8, 800, 600),
                    attention: false,
                },
                Reseed {
                    pane: two,
                    url: "https://last.example/two".to_string(),
                    bounds: Bounds::new(4, 8, 800, 600),
                    attention: true,
                },
            ]
        );
    }

    #[test]
    fn a_pane_the_graph_has_no_url_for_falls_back_to_what_the_chrome_asked_for() {
        let pane = Supervisor::<tauri::Wry>::pane_id("pane-9");
        let open = vec![(pane, record("pane-9", "https://asked.example/", false))];

        let empty = reseed_plan(&BTreeMap::new(), &open);
        assert_eq!(empty[0].url, "https://asked.example/");

        let blank = BTreeMap::from([(pane, String::new())]);
        assert_eq!(reseed_plan(&blank, &open)[0].url, "https://asked.example/");
    }

    #[test]
    fn a_pane_the_chrome_has_already_closed_is_not_resurrected() {
        let closed = Supervisor::<tauri::Wry>::pane_id("pane-4");
        let restored = BTreeMap::from([(closed, "https://gone.example/".to_string())]);
        assert!(reseed_plan(&restored, &[]).is_empty());
    }
}
