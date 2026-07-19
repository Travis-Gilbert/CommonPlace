//! Host-level tests, driven through a fake engine.
//!
//! Everything here would otherwise need libservo. The fake records the calls
//! the host makes and replays the events a real engine would produce, which is
//! enough to pin the protocol contract, B7's refusals, B5's sampling gate, and
//! B6's script dispatch.

use std::collections::{BTreeSet, VecDeque};
use std::io::Write;
use std::sync::mpsc::channel;
use std::sync::{Arc, Mutex};

use pane_protocol::{
    read_frame, Bounds, Envelope, ErrorKind, Outbound, PaneEvent, PaneId, ParentSurface, Request,
    ResponseValue, TextSpan,
};
use serde_json::{json, Value};

use crate::engine::{Engine, EngineError, EngineEvent, EngineResult};
use crate::server::{run, Host};
use crate::session::{GraphTransport, SessionError, SessionGraph};

#[derive(Default)]
struct FakeState {
    calls: Vec<String>,
    events: VecDeque<EngineEvent>,
    js_results: VecDeque<String>,
    js_calls: Vec<(PaneId, String)>,
    panes: BTreeSet<PaneId>,
}

#[derive(Clone, Default)]
struct FakeEngine(Arc<Mutex<FakeState>>);

impl FakeEngine {
    fn state(&self) -> std::sync::MutexGuard<'_, FakeState> {
        self.0.lock().expect("fake engine lock")
    }

    fn emit(&self, event: EngineEvent) {
        self.state().events.push_back(event);
    }

    fn answer_js(&self, value: &str) {
        self.state().js_results.push_back(value.to_string());
    }

    fn calls(&self) -> Vec<String> {
        self.state().calls.clone()
    }

    fn js_calls(&self) -> Vec<(PaneId, String)> {
        self.state().js_calls.clone()
    }

    fn note(&self, call: impl Into<String>) {
        self.state().calls.push(call.into());
    }

    fn known(&self, pane: PaneId) -> EngineResult {
        if self.state().panes.contains(&pane) {
            Ok(())
        } else {
            Err(EngineError::unknown_pane(pane))
        }
    }
}

impl Engine for FakeEngine {
    fn create_pane(
        &mut self,
        pane: PaneId,
        parent: ParentSurface,
        bounds: Bounds,
        url: &str,
    ) -> EngineResult {
        self.note(format!(
            "create {pane} on {} at {}x{} -> {url}",
            parent.platform(),
            bounds.width,
            bounds.height
        ));
        self.state().panes.insert(pane);
        Ok(())
    }

    fn navigate(&mut self, pane: PaneId, url: &str) -> EngineResult {
        self.known(pane)?;
        self.note(format!("navigate {pane} -> {url}"));
        Ok(())
    }

    fn back(&mut self, pane: PaneId) -> EngineResult {
        self.known(pane)?;
        self.note(format!("back {pane}"));
        Ok(())
    }

    fn forward(&mut self, pane: PaneId) -> EngineResult {
        self.known(pane)?;
        self.note(format!("forward {pane}"));
        Ok(())
    }

    fn reload(&mut self, pane: PaneId) -> EngineResult {
        self.known(pane)?;
        self.note(format!("reload {pane}"));
        Ok(())
    }

    fn set_bounds(&mut self, pane: PaneId, bounds: Bounds) -> EngineResult {
        self.known(pane)?;
        self.note(format!("bounds {pane} {}x{}", bounds.width, bounds.height));
        Ok(())
    }

    fn set_visible(&mut self, pane: PaneId, visible: bool) -> EngineResult {
        self.known(pane)?;
        self.note(format!("visible {pane} {visible}"));
        Ok(())
    }

    fn close(&mut self, pane: PaneId) -> EngineResult {
        self.known(pane)?;
        self.note(format!("close {pane}"));
        self.state().panes.remove(&pane);
        Ok(())
    }

    fn evaluate_js(&mut self, pane: PaneId, script: &str) -> EngineResult<String> {
        self.known(pane)?;
        let mut state = self.state();
        state.js_calls.push((pane, script.to_string()));
        Ok(state.js_results.pop_front().unwrap_or_default())
    }

    fn poll_events(&mut self) -> Vec<EngineEvent> {
        self.state().events.drain(..).collect()
    }

    fn spin(&mut self) {}
}

/// A transport that accepts every write. The session graph's own shape is
/// covered in `session::tests`; here it only has to not get in the way.
#[derive(Clone, Default)]
struct NullNode(Arc<Mutex<Vec<Value>>>);

impl NullNode {
    fn commands(&self) -> Vec<String> {
        self.0
            .lock()
            .expect("null node lock")
            .iter()
            .flat_map(|body| body["commands"].as_array().cloned().unwrap_or_default())
            .map(|item| item["command"].as_str().unwrap_or_default().to_string())
            .collect()
    }

    fn visits(&self) -> Vec<Value> {
        self.0
            .lock()
            .expect("null node lock")
            .iter()
            .flat_map(|body| body["commands"].as_array().cloned().unwrap_or_default())
            .filter(|item| item["args"]["labels"] == json!(["Visit"]))
            .map(|item| item["args"]["properties"].clone())
            .collect()
    }
}

impl GraphTransport for NullNode {
    fn batch(&self, body: Value) -> Result<Value, SessionError> {
        let count = body["commands"].as_array().map(Vec::len).unwrap_or_default();
        self.0.lock().expect("null node lock").push(body);
        Ok(json!({
            "ok": true,
            "results": vec![json!({ "ok": true, "nodes": [] }); count],
        }))
    }
}

/// A writer the test can read back while the loop still holds it.
#[derive(Clone, Default)]
struct SharedBuffer(Arc<Mutex<Vec<u8>>>);

impl Write for SharedBuffer {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0.lock().expect("buffer lock").extend_from_slice(buf);
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl SharedBuffer {
    fn frames(&self) -> Vec<Outbound> {
        let bytes = self.0.lock().expect("buffer lock").clone();
        let mut cursor = bytes.as_slice();
        let mut frames = Vec::new();
        while let Ok(frame) = read_frame::<_, Outbound>(&mut cursor) {
            frames.push(frame);
        }
        frames
    }
}

fn host(engine: FakeEngine, node: NullNode) -> Host<FakeEngine, NullNode> {
    Host::new(engine, SessionGraph::new(node))
}

fn create(id: u64, pane: u64, url: &str) -> Envelope {
    Envelope {
        id,
        request: Request::Create {
            pane: PaneId(pane),
            parent: ParentSurface::AppKit { ns_view: 0x1000 },
            bounds: Bounds::new(0, 0, 800, 600),
            url: url.to_string(),
        },
    }
}

fn responses(frames: &[Outbound]) -> Vec<(u64, Result<ResponseValue, pane_protocol::PaneError>)> {
    frames
        .iter()
        .filter_map(|frame| match frame {
            Outbound::Response(response) => Some((response.id, response.result.clone())),
            Outbound::Event(_) => None,
        })
        .collect()
}

fn events(frames: &[Outbound]) -> Vec<PaneEvent> {
    frames
        .iter()
        .filter_map(|frame| match frame {
            Outbound::Event(event) => Some(event.clone()),
            Outbound::Response(_) => None,
        })
        .collect()
}

#[test]
fn create_navigate_resize_close_round_trips_over_the_protocol() {
    let engine = FakeEngine::default();
    let node = NullNode::default();
    let mut subject = host(engine.clone(), node.clone());
    let buffer = SharedBuffer::default();
    let (sender, receiver) = channel();

    sender.send(create(1, 9, "https://example.com/start")).expect("queued");
    sender
        .send(Envelope {
            id: 2,
            request: Request::Navigate {
                pane: PaneId(9),
                url: "https://example.com/next#anchor".to_string(),
            },
        })
        .expect("queued");
    sender
        .send(Envelope {
            id: 3,
            request: Request::SetBounds {
                pane: PaneId(9),
                bounds: Bounds::new(4, 8, 1024, 768),
            },
        })
        .expect("queued");
    sender
        .send(Envelope {
            id: 4,
            request: Request::Close { pane: PaneId(9) },
        })
        .expect("queued");
    drop(sender);

    let mut writer = buffer.clone();
    run(&mut subject, &receiver, &mut writer).expect("loop runs to a clean close");

    let frames = buffer.frames();
    let answered = responses(&frames);
    assert_eq!(
        answered
            .iter()
            .map(|(id, result)| (*id, result.is_ok()))
            .collect::<Vec<_>>(),
        vec![(1, true), (2, true), (3, true), (4, true)]
    );
    assert_eq!(
        answered[0].1.clone().unwrap(),
        ResponseValue::Navigating {
            canonical_url: "https://example.com/start".to_string()
        }
    );
    assert_eq!(
        answered[1].1.clone().unwrap(),
        ResponseValue::Navigating {
            canonical_url: "https://example.com/next".to_string()
        },
        "the omnibox is told the post-canonicalization destination"
    );

    assert_eq!(
        engine.calls(),
        vec![
            "create pane:9 on appkit at 800x600 -> https://example.com/start",
            "navigate pane:9 -> https://example.com/next",
            "bounds pane:9 1024x768",
            "close pane:9",
        ]
    );
}

#[test]
fn a_file_url_is_refused_with_a_typed_error_and_an_event() {
    let engine = FakeEngine::default();
    let mut subject = host(engine.clone(), NullNode::default());
    subject.handle(create(1, 1, "https://example.com/"));

    let frames = subject.handle(Envelope {
        id: 2,
        request: Request::Navigate {
            pane: PaneId(1),
            url: "file:///etc/passwd".to_string(),
        },
    });

    let error = responses(&frames)[0].1.clone().expect_err("refused");
    assert_eq!(error.kind, ErrorKind::SchemeRefused);
    match &events(&frames)[0] {
        PaneEvent::NavigationRefused { pane, url, error } => {
            assert_eq!(*pane, PaneId(1));
            assert_eq!(url, "file:///etc/passwd");
            assert_eq!(error.kind, ErrorKind::SchemeRefused);
        }
        other => panic!("expected NavigationRefused, got {other:?}"),
    }
    assert!(
        !engine.calls().iter().any(|call| call.contains("file://")),
        "a refused URL never reaches the engine"
    );
}

#[test]
fn a_redirect_chain_ends_at_the_canonical_url_in_the_event_and_the_visit() {
    let engine = FakeEngine::default();
    let node = NullNode::default();
    let mut subject = host(engine.clone(), node.clone());
    subject.handle(create(1, 2, "http://example.com/short"));

    // Where the engine says the load actually ended, fragment and all.
    engine.emit(EngineEvent::LoadStable {
        pane: PaneId(2),
        url: "https://example.com/final/page#section".to_string(),
    });
    let frames = subject.tick();

    match &events(&frames)[0] {
        PaneEvent::LoadStable { url, .. } => {
            assert_eq!(url, "https://example.com/final/page")
        }
        other => panic!("expected LoadStable, got {other:?}"),
    }
    let visits = node.visits();
    assert_eq!(visits.len(), 1);
    assert_eq!(visits[0]["url_canon"], json!("https://example.com/final/page"));
    assert_eq!(visits[0]["pane"], json!(2));
}

#[test]
fn three_navigations_file_three_visits_in_order() {
    let engine = FakeEngine::default();
    let node = NullNode::default();
    let mut subject = host(engine.clone(), node.clone());
    subject.handle(create(1, 5, "https://a.example/"));

    for url in ["https://a.example/", "https://b.example/", "https://c.example/"] {
        engine.emit(EngineEvent::LoadStable {
            pane: PaneId(5),
            url: url.to_string(),
        });
        subject.tick();
    }

    let visits = node.visits();
    assert_eq!(
        visits
            .iter()
            .map(|visit| visit["url_canon"].as_str().unwrap_or_default())
            .collect::<Vec<_>>(),
        vec!["https://a.example/", "https://b.example/", "https://c.example/"]
    );
    assert_eq!(
        visits
            .iter()
            .map(|visit| visit["seq"].as_u64().unwrap_or_default())
            .collect::<Vec<_>>(),
        vec![0, 1, 2]
    );
    assert_eq!(
        node.commands()
            .iter()
            .filter(|command| command.ends_with("EDGE.UPSERT"))
            .count(),
        2,
        "two NEXT edges chain three visits"
    );
}

#[test]
fn attention_is_off_by_default_so_nothing_is_sampled() {
    let engine = FakeEngine::default();
    let mut subject = host(engine.clone(), NullNode::default());
    subject.handle(create(1, 3, "https://example.com/"));

    for _ in 0..5 {
        subject.tick();
    }

    assert_eq!(subject.attention_samples(PaneId(3)), 0);
    assert!(engine.js_calls().is_empty(), "no evaluate_js while attention is off");
}

#[test]
fn attention_on_samples_and_off_stops_sampling_entirely() {
    let engine = FakeEngine::default();
    let mut subject = host(engine.clone(), NullNode::default());
    subject.handle(create(1, 3, "https://example.com/"));

    let frames = subject.handle(Envelope {
        id: 2,
        request: Request::SetAttention {
            pane: PaneId(3),
            on: true,
        },
    });
    assert_eq!(
        events(&frames),
        vec![PaneEvent::AttentionChanged {
            pane: PaneId(3),
            on: true
        }]
    );

    engine.answer_js(&json!({ "settled": true, "text": "Visible paragraph." }).to_string());
    let frames = subject.tick();
    assert_eq!(subject.attention_samples(PaneId(3)), 1);
    match &events(&frames)[0] {
        PaneEvent::AttentionSpan {
            pane,
            url,
            spans,
            sequence,
        } => {
            assert_eq!(*pane, PaneId(3));
            assert_eq!(url, "https://example.com/");
            assert_eq!(spans[0].quote, "Visible paragraph.");
            assert_eq!(*sequence, 1);
        }
        other => panic!("expected AttentionSpan, got {other:?}"),
    }

    let before = engine.js_calls().len();
    let frames = subject.handle(Envelope {
        id: 3,
        request: Request::SetAttention {
            pane: PaneId(3),
            on: false,
        },
    });
    assert_eq!(
        events(&frames),
        vec![PaneEvent::AttentionChanged {
            pane: PaneId(3),
            on: false
        }]
    );
    for _ in 0..5 {
        subject.tick();
    }
    assert_eq!(subject.attention_samples(PaneId(3)), 1, "the counter froze");
    assert_eq!(engine.js_calls().len(), before, "no calls at all, not discarded results");
}

#[test]
fn highlighting_and_clearing_reach_the_page() {
    let engine = FakeEngine::default();
    let mut subject = host(engine.clone(), NullNode::default());
    subject.handle(create(1, 6, "https://example.com/"));

    subject.handle(Envelope {
        id: 2,
        request: Request::Highlight {
            pane: PaneId(6),
            spans: vec![TextSpan {
                start: 0,
                end: 5,
                quote: "quote".to_string(),
                prefix: "before ".to_string(),
                suffix: " after".to_string(),
            }],
        },
    });
    subject.handle(Envelope {
        id: 3,
        request: Request::ClearHighlight { pane: PaneId(6) },
    });

    let scripts = engine.js_calls();
    assert_eq!(scripts.len(), 2);
    assert!(scripts[0].1.contains("\"quote\":\"quote\""));
    assert!(scripts[0].1.contains("\"prefix\":\"before \""));
    assert!(scripts[1].1.contains("normalize()"));
}

#[test]
fn requests_for_a_pane_the_host_does_not_have_are_refused() {
    let mut subject = host(FakeEngine::default(), NullNode::default());
    let frames = subject.handle(Envelope {
        id: 1,
        request: Request::Navigate {
            pane: PaneId(42),
            url: "https://example.com/".to_string(),
        },
    });
    let error = responses(&frames)[0].1.clone().expect_err("refused");
    assert_eq!(error.kind, ErrorKind::UnknownPane);
}

#[test]
fn a_crash_drops_the_pane_and_tells_the_chrome() {
    let engine = FakeEngine::default();
    let mut subject = host(engine.clone(), NullNode::default());
    subject.handle(create(1, 7, "https://example.com/"));

    engine.emit(EngineEvent::Crashed {
        pane: PaneId(7),
        reason: "renderer gone".to_string(),
    });
    let frames = subject.tick();
    assert_eq!(
        events(&frames),
        vec![PaneEvent::Crashed {
            pane: PaneId(7),
            reason: "renderer gone".to_string()
        }]
    );

    let frames = subject.handle(Envelope {
        id: 2,
        request: Request::SetAttention {
            pane: PaneId(7),
            on: true,
        },
    });
    assert_eq!(
        responses(&frames)[0].1.clone().expect_err("gone").kind,
        ErrorKind::UnknownPane
    );
}

#[test]
fn a_title_rewrites_the_visit_it_belongs_to_rather_than_adding_one() {
    let engine = FakeEngine::default();
    let node = NullNode::default();
    let mut subject = host(engine.clone(), node.clone());
    subject.handle(create(1, 8, "https://example.com/"));

    engine.emit(EngineEvent::LoadStable {
        pane: PaneId(8),
        url: "https://example.com/".to_string(),
    });
    subject.tick();
    engine.emit(EngineEvent::TitleChanged {
        pane: PaneId(8),
        title: "Example".to_string(),
    });
    subject.tick();

    let visits = node.visits();
    assert_eq!(visits.len(), 2, "one insert plus one in-place rewrite");
    assert_eq!(visits[0]["seq"], visits[1]["seq"]);
    assert_eq!(visits[1]["title"], json!("Example"));
}

#[test]
fn a_ping_is_answered_so_the_supervisor_can_probe_liveness() {
    let mut subject = host(FakeEngine::default(), NullNode::default());
    let frames = subject.handle(Envelope {
        id: 1,
        request: Request::Ping,
    });
    assert_eq!(responses(&frames)[0].1.clone().unwrap(), ResponseValue::Pong);
}

#[test]
fn a_screenshot_is_refused_rather_than_hanging_when_the_engine_cannot_capture() {
    let mut subject = host(FakeEngine::default(), NullNode::default());
    subject.handle(create(1, 1, "https://example.com/"));
    let frames = subject.handle(Envelope {
        id: 2,
        request: Request::Screenshot { pane: PaneId(1) },
    });
    assert_eq!(
        responses(&frames)[0].1.clone().expect_err("no capture API").kind,
        ErrorKind::Unavailable
    );
}
