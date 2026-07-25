//! A pane host with no engine in it, for testing supervision.
//!
//! The real host cannot be built without libservo, and the supervisor's most
//! important behaviour — noticing that the host died and bringing it back — can
//! only be exercised against a real child process. So this speaks the protocol
//! and nothing else: it answers requests plausibly and appends each one to the
//! file named by `FAKE_PANE_HOST_LOG`, which is how a test sees what the
//! supervisor asked for across a restart.

use std::io::Write;

use pane_protocol::{read_frame, write_frame, CodecError, Envelope, Outbound, Request, Response, ResponseValue};

fn main() {
    let log = std::env::var("FAKE_PANE_HOST_LOG").ok();
    let mut input = std::io::stdin().lock();
    let mut output = std::io::stdout().lock();

    loop {
        let envelope: Envelope = match read_frame(&mut input) {
            Ok(envelope) => envelope,
            Err(CodecError::Eof) => return,
            Err(_) => return,
        };
        if let Some(path) = &log {
            if let Ok(mut file) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
                let _ = writeln!(file, "{}", describe(&envelope.request));
            }
        }
        let result = Ok(match &envelope.request {
            Request::Ping => ResponseValue::Pong,
            Request::Create { url, .. } | Request::Navigate { url, .. } => {
                ResponseValue::Navigating {
                    canonical_url: url.clone(),
                }
            }
            Request::EvaluateJs { .. } => ResponseValue::Js {
                value: String::new(),
            },
            _ => ResponseValue::Ack,
        });
        if write_frame(
            &mut output,
            &Outbound::Response(Response {
                id: envelope.id,
                result,
            }),
        )
        .is_err()
        {
            return;
        }
    }
}

fn describe(request: &Request) -> String {
    match request {
        Request::Create { pane, url, bounds, .. } => {
            format!("create {pane} {url} {}x{}", bounds.width, bounds.height)
        }
        Request::Navigate { pane, url } => format!("navigate {pane} {url}"),
        Request::SetAttention { pane, on } => format!("attention {pane} {on}"),
        Request::Close { pane } => format!("close {pane}"),
        other => format!("{other:?}"),
    }
}
