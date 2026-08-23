//! SSE framing for AI SDK UI-message streams.

use crate::parts::{parse_part_json, StreamPart};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum SseEvent {
    Part(StreamPart),
    Done,
    Comment(String),
    Ping,
}

/// Parse one or more SSE blocks, including multi-line `data:` payloads.
///
/// # Errors
///
/// Returns a labeled error when a complete `data:` payload is not a valid
/// UI-message stream part.
pub fn parse_sse_chunk(chunk: &str) -> Result<Vec<SseEvent>, String> {
    let mut events = Vec::new();
    let mut data_lines = Vec::new();
    for raw in chunk.lines() {
        let line = raw.trim_end_matches('\r');
        if line.is_empty() {
            flush_data(&mut data_lines, &mut events)?;
        } else if let Some(comment) = line.strip_prefix(':') {
            events.push(SseEvent::Comment(comment.trim().to_owned()));
        } else if let Some(data) = line.strip_prefix("data:") {
            let payload = data.strip_prefix(' ').unwrap_or(data);
            if payload == "[DONE]" {
                flush_data(&mut data_lines, &mut events)?;
                events.push(SseEvent::Done);
            } else {
                data_lines.push(payload.to_owned());
            }
        } else if line
            .strip_prefix("event:")
            .is_some_and(|event| event.trim() == "ping")
        {
            events.push(SseEvent::Ping);
        }
    }
    flush_data(&mut data_lines, &mut events)?;
    Ok(events)
}

fn flush_data(data_lines: &mut Vec<String>, events: &mut Vec<SseEvent>) -> Result<(), String> {
    if data_lines.is_empty() {
        return Ok(());
    }
    let joined = data_lines.join("\n");
    data_lines.clear();
    let part = parse_part_json(&joined).map_err(|error| format!("part json: {error}: {joined}"))?;
    events.push(SseEvent::Part(part));
    Ok(())
}

/// Parse a captured UI-message SSE document in event order.
///
/// # Errors
///
/// Returns the same labeled parse failure as [`parse_sse_chunk`].
pub fn parse_sse_stream(document: &str) -> Result<Vec<SseEvent>, String> {
    parse_sse_chunk(document)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_parts_fixture_reaches_done_without_dropping_events() {
        let events = parse_sse_stream(include_str!("../fixtures/all-parts.sse")).unwrap();
        assert!(events.iter().any(|event| matches!(event, SseEvent::Done)));
        assert_eq!(
            events
                .iter()
                .filter(|event| matches!(event, SseEvent::Part(_)))
                .count(),
            29
        );
    }
}
