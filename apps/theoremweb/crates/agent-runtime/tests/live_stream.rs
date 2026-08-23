//! Environment-gated V06 oracle for a real UI-message SSE run.

use std::{
    fs,
    io::Write,
    process::{Command, Stdio},
};

use theoremweb_agent_runtime::{
    parse_sse_stream, render_part, KnownStreamPart, SseEvent, StreamPart,
};

#[test]
#[ignore = "live_oracle_required: set AGENT_RUNTIME_LIVE=1 and a real stream endpoint"]
fn live_proxy_stream_covers_required_part_affordances() {
    assert_eq!(
        std::env::var("AGENT_RUNTIME_LIVE").ok().as_deref(),
        Some("1"),
        "AGENT_RUNTIME_LIVE=1 is required"
    );
    let url = std::env::var("AGENT_RUNTIME_LIVE_STREAM_URL")
        .expect("AGENT_RUNTIME_LIVE_STREAM_URL is required");
    let token_file = std::env::var("THEOREMWEB_AUTH_TOKEN_FILE")
        .expect("THEOREMWEB_AUTH_TOKEN_FILE is required");
    let token = fs::read_to_string(token_file)
        .expect("read token file")
        .trim()
        .to_owned();
    assert!(!token.is_empty(), "token file is empty");

    let mut command = Command::new("curl");
    command
        .args(["-fNsS", "--config", "-", &url])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Ok(body_file) = std::env::var("AGENT_RUNTIME_LIVE_REQUEST_FILE") {
        command.args([
            "--request",
            "POST",
            "--header",
            "Content-Type: application/json",
            "--data-binary",
            &format!("@{body_file}"),
        ]);
    }
    let mut child = command.spawn().expect("spawn curl");
    writeln!(
        child.stdin.as_mut().expect("curl config stdin"),
        "header = \"Authorization: Bearer {token}\""
    )
    .expect("write curl authorization config");
    let output = child.wait_with_output().expect("wait for live stream");
    assert!(
        output.status.success(),
        "live stream failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let document = String::from_utf8(output.stdout).expect("stream is UTF-8 SSE");
    let parts = parse_sse_stream(&document)
        .expect("parse live UI-message SSE")
        .into_iter()
        .filter_map(|event| match event {
            SseEvent::Part(part) => Some(part),
            _ => None,
        })
        .collect::<Vec<_>>();

    assert!(parts
        .iter()
        .any(|part| matches!(part, StreamPart::Known(KnownStreamPart::TextDelta { .. }))));
    assert!(parts.iter().any(|part| matches!(
        part,
        StreamPart::Known(KnownStreamPart::ReasoningDelta { .. })
    )));
    assert!(parts.iter().any(|part| matches!(
        part,
        StreamPart::Known(KnownStreamPart::ToolInputAvailable { .. })
    )));
    assert!(parts.iter().any(|part| matches!(
        part,
        StreamPart::Known(
            KnownStreamPart::SourceUrl { .. } | KnownStreamPart::SourceDocument { .. }
        )
    )));
    assert!(parts.iter().any(|part| matches!(
        part,
        StreamPart::Known(KnownStreamPart::ToolApprovalRequest { .. })
    )));
    assert!(parts
        .iter()
        .any(|part| matches!(part, StreamPart::Data { .. })));
    assert!(parts
        .iter()
        .map(render_part)
        .all(|part| !part.label.is_empty()));
}
