//! B2 (host half) — the protocol loop.
//!
//! One thread, one engine. Servo's `WebView` is `Rc`-based and not `Send`, so
//! there is no version of this that services requests on a pool; the loop reads
//! whatever requests have arrived, services them, pumps the engine, drains its
//! events, and writes frames back.
//!
//! Requests arrive on a channel rather than being read inline, because a
//! blocking `read_frame` on stdin would stop the engine from spinning while the
//! chrome had nothing to say — and a browser that only renders when clicked is
//! not a browser. A reader thread owns the blocking read; this loop never
//! blocks on it.

use std::collections::BTreeMap;
use std::io::{Read, Write};
use std::sync::mpsc::{Receiver, TryRecvError};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use pane_protocol::{
    read_frame, write_frame, CodecError, Envelope, Outbound, PaneError, PaneEvent, PaneId, Request,
    Response, ResponseValue,
};

use crate::attention::Attention;
use crate::engine::{Engine, EngineEvent};
use crate::highlight::{apply_script, clear_script};
use crate::nav;
use crate::session::{GraphTransport, SessionGraph};

/// How long the loop sleeps when there is nothing to do. Short enough that a
/// click feels immediate, long enough that an idle browser is not a busy loop.
const IDLE: Duration = Duration::from_millis(2);

/// Minimum gap between viewport samples on one pane (B5). `evaluate_js` blocks
/// the single engine thread, so sampling on every tick would starve the other
/// panes.
const SAMPLE_INTERVAL: Duration = Duration::from_millis(250);

/// What the host remembers about a pane between requests.
struct PaneState {
    url: String,
    title: String,
    attention: Attention,
    last_sample: Option<Instant>,
}

impl PaneState {
    fn new(url: String) -> Self {
        Self {
            url,
            title: String::new(),
            attention: Attention::new(),
            last_sample: None,
        }
    }
}

pub struct Host<E: Engine, G: GraphTransport> {
    engine: E,
    graph: SessionGraph<G>,
    panes: BTreeMap<PaneId, PaneState>,
}

impl<E: Engine, G: GraphTransport> Host<E, G> {
    pub fn new(engine: E, graph: SessionGraph<G>) -> Self {
        Self {
            engine,
            graph,
            panes: BTreeMap::new(),
        }
    }

    /// Sample count for a pane, so the B5 gate can be proved rather than
    /// asserted.
    pub fn attention_samples(&self, pane: PaneId) -> u64 {
        self.panes
            .get(&pane)
            .map(|state| state.attention.samples())
            .unwrap_or_default()
    }

    /// Service one request. Returns the correlated response first, followed by
    /// any events the request itself caused.
    pub fn handle(&mut self, envelope: Envelope) -> Vec<Outbound> {
        let Envelope { id, request } = envelope;
        let mut events = Vec::new();
        let result = self.service(request, &mut events);
        let mut out = vec![Outbound::Response(Response { id, result })];
        out.extend(events.into_iter().map(Outbound::Event));
        out
    }

    /// Pump the engine once and collect everything it produced.
    pub fn tick(&mut self) -> Vec<Outbound> {
        self.engine.spin();
        let mut events = Vec::new();
        for event in self.engine.poll_events() {
            self.absorb(event, &mut events);
        }
        self.sample_attention(&mut events);
        events.into_iter().map(Outbound::Event).collect()
    }

    fn service(
        &mut self,
        request: Request,
        events: &mut Vec<PaneEvent>,
    ) -> Result<ResponseValue, PaneError> {
        match request {
            Request::Ping => Ok(ResponseValue::Pong),
            Request::Create {
                pane,
                parent,
                bounds,
                url,
            } => {
                let canonical = self.check_url(pane, &url, events)?;
                self.engine.create_pane(pane, parent, bounds, &canonical)?;
                self.panes.insert(pane, PaneState::new(canonical.clone()));
                Ok(ResponseValue::Navigating {
                    canonical_url: canonical,
                })
            }
            Request::Navigate { pane, url } => {
                self.require(pane)?;
                let canonical = self.check_url(pane, &url, events)?;
                self.engine.navigate(pane, &canonical)?;
                Ok(ResponseValue::Navigating {
                    canonical_url: canonical,
                })
            }
            Request::Back { pane } => self.engine.back(pane).map(|_| ResponseValue::Ack).map_err(Into::into),
            Request::Forward { pane } => self
                .engine
                .forward(pane)
                .map(|_| ResponseValue::Ack)
                .map_err(Into::into),
            Request::Reload { pane } => self
                .engine
                .reload(pane)
                .map(|_| ResponseValue::Ack)
                .map_err(Into::into),
            Request::SetBounds { pane, bounds } => self
                .engine
                .set_bounds(pane, bounds)
                .map(|_| ResponseValue::Ack)
                .map_err(Into::into),
            Request::SetVisible { pane, visible } => self
                .engine
                .set_visible(pane, visible)
                .map(|_| ResponseValue::Ack)
                .map_err(Into::into),
            Request::Close { pane } => {
                self.engine.close(pane)?;
                self.panes.remove(&pane);
                Ok(ResponseValue::Ack)
            }
            Request::EvaluateJs { pane, script } => self
                .engine
                .evaluate_js(pane, &script)
                .map(|value| ResponseValue::Js { value })
                .map_err(Into::into),
            Request::SetAttention { pane, on } => {
                let state = self.panes.get_mut(&pane).ok_or_else(|| PaneError::unknown_pane(pane))?;
                state.attention.set(on);
                // Echoed unconditionally: the chip renders the HOST's state, so
                // a request that changed nothing still has to be confirmed.
                events.push(PaneEvent::AttentionChanged { pane, on });
                Ok(ResponseValue::Ack)
            }
            Request::Highlight { pane, spans } => {
                self.require(pane)?;
                self.engine.evaluate_js(pane, &apply_script(&spans))?;
                Ok(ResponseValue::Ack)
            }
            Request::ClearHighlight { pane } => {
                self.require(pane)?;
                self.engine.evaluate_js(pane, &clear_script())?;
                Ok(ResponseValue::Ack)
            }
            Request::Screenshot { pane } => self
                .engine
                .screenshot(pane)
                .map(|png| ResponseValue::Screenshot { png })
                .map_err(Into::into),
        }
    }

    fn require(&self, pane: PaneId) -> Result<(), PaneError> {
        if self.panes.contains_key(&pane) {
            Ok(())
        } else {
            Err(PaneError::unknown_pane(pane))
        }
    }

    /// B7. A refusal is announced as well as returned: the response tells the
    /// caller its request failed, the event tells the pane's UI why it is still
    /// showing the previous page.
    fn check_url(
        &self,
        pane: PaneId,
        url: &str,
        events: &mut Vec<PaneEvent>,
    ) -> Result<String, PaneError> {
        match nav::resolve(url) {
            Ok(canonical) => Ok(canonical),
            Err(error) => {
                events.push(PaneEvent::NavigationRefused {
                    pane,
                    url: url.to_string(),
                    error: error.clone(),
                });
                Err(error)
            }
        }
    }

    fn absorb(&mut self, event: EngineEvent, events: &mut Vec<PaneEvent>) {
        match event {
            EngineEvent::LoadStart { pane, url } => events.push(PaneEvent::LoadStart { pane, url }),
            EngineEvent::UrlChanged { pane, url } => {
                let url = canonical_or_raw(&url);
                if let Some(state) = self.panes.get_mut(&pane) {
                    state.url = url.clone();
                }
                events.push(PaneEvent::UrlChanged { pane, url });
            }
            EngineEvent::TitleChanged { pane, title } => {
                let url = match self.panes.get_mut(&pane) {
                    Some(state) => {
                        state.title = title.clone();
                        state.url.clone()
                    }
                    None => String::new(),
                };
                let filed = self.graph.retitle_last_visit(pane, &url, &title, now_ms());
                self.file(filed);
                events.push(PaneEvent::TitleChanged { pane, title });
            }
            EngineEvent::LoadStable { pane, url } => {
                // The engine reports where the load actually ended, so this is
                // the URL after every redirect. Canonicalizing here is what
                // makes the omnibox and the visit chain agree on one string.
                let url = canonical_or_raw(&url);
                let title = match self.panes.get_mut(&pane) {
                    Some(state) => {
                        state.url = url.clone();
                        // A fresh document has nothing on screen that was
                        // already observed.
                        state.last_sample = None;
                        state.title.clone()
                    }
                    None => String::new(),
                };
                let filed = self.graph.record_visit(pane, &url, &title, now_ms());
                self.file(filed);
                events.push(PaneEvent::LoadStable { pane, url });
            }
            EngineEvent::Crashed { pane, reason } => {
                self.panes.remove(&pane);
                events.push(PaneEvent::Crashed { pane, reason });
            }
        }
    }

    /// B5. Only panes with attention on are sampled, and the script is only
    /// asked for when it is going to be evaluated.
    fn sample_attention(&mut self, events: &mut Vec<PaneEvent>) {
        let due: Vec<PaneId> = self
            .panes
            .iter()
            .filter(|(_, state)| {
                state.attention.is_on()
                    && state
                        .last_sample
                        .map(|at| at.elapsed() >= SAMPLE_INTERVAL)
                        .unwrap_or(true)
            })
            .map(|(pane, _)| *pane)
            .collect();

        for pane in due {
            let Some(state) = self.panes.get_mut(&pane) else {
                continue;
            };
            let Some(script) = state.attention.sample_script() else {
                continue;
            };
            state.last_sample = Some(Instant::now());
            let Ok(raw) = self.engine.evaluate_js(pane, &script) else {
                continue;
            };
            let Some(state) = self.panes.get_mut(&pane) else {
                continue;
            };
            let url = state.url.clone();
            if let Some(observation) = state.attention.observe(&raw) {
                events.push(PaneEvent::AttentionSpan {
                    pane,
                    url,
                    spans: observation.spans,
                    sequence: observation.sequence,
                });
            }
        }
    }

    /// A graph write that failed must never break navigation. It is reported on
    /// stderr, which the supervisor already captures, and the page still loads.
    fn file(&self, outcome: Result<(), crate::session::SessionError>) {
        if let Err(error) = outcome {
            eprintln!("[pane-host] {error}");
        }
    }
}

fn canonical_or_raw(url: &str) -> String {
    nav::resolve(url).unwrap_or_else(|_| url.to_string())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as u64)
        .unwrap_or_default()
}

/// Drive a host until the request channel closes.
///
/// The channel closing means the reader thread saw EOF on the pipe, which means
/// the chrome is gone; there is nothing left to render for.
pub fn run<E: Engine, G: GraphTransport, W: Write>(
    host: &mut Host<E, G>,
    requests: &Receiver<Envelope>,
    writer: &mut W,
) -> Result<(), CodecError> {
    loop {
        let mut worked = false;
        loop {
            match requests.try_recv() {
                Ok(envelope) => {
                    worked = true;
                    for frame in host.handle(envelope) {
                        write_frame(writer, &frame)?;
                    }
                }
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => return Ok(()),
            }
        }
        for frame in host.tick() {
            worked = true;
            write_frame(writer, &frame)?;
        }
        if !worked {
            std::thread::sleep(IDLE);
        }
    }
}

/// Read `Envelope` frames off `reader` and forward them to `run`.
///
/// Split out so the loop above can be driven from a test channel: the framing
/// is already covered by `pane-protocol`'s own tests, and re-testing it through
/// a pipe would only prove `std::io` works.
pub fn read_requests<R: Read>(mut reader: R, sender: std::sync::mpsc::Sender<Envelope>) {
    loop {
        match read_frame::<_, Envelope>(&mut reader) {
            Ok(envelope) => {
                if sender.send(envelope).is_err() {
                    return;
                }
            }
            Err(CodecError::Eof) => return,
            Err(error) => {
                eprintln!("[pane-host] {error}");
                return;
            }
        }
    }
}
