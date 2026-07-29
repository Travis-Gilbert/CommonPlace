//! Fake pane-host for GPUI sidecar supervision tests.
//!
//! Speaks pane-protocol over stdin/stdout with no Servo. Appends each request
//! to `FAKE_PANE_HOST_LOG` so a test can see what survived a restart.

use pane_protocol::{
    read_frame, write_frame, CodecError, Envelope, Outbound, Request, Response, ResponseValue,
};
use std::io::Write;

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
            if let Ok(mut file) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
            {
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
        Request::Create {
            pane, url, bounds, ..
        } => {
            format!("create {pane} {url} {}x{}", bounds.width, bounds.height)
        }
        Request::Navigate { pane, url } => format!("navigate {pane} {url}"),
        Request::SetAttention { pane, on } => format!("attention {pane} {on}"),
        Request::Close { pane } => format!("close {pane}"),
        other => format!("{other:?}"),
    }
}
