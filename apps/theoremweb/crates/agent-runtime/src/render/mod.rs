//! Total UI projection for every stream-part class.

use dioxus::prelude::*;
use serde_json::Value;

use crate::{KnownStreamPart, ScopeBinding, ScopeChip, StreamPart};

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RenderedPartKind {
    Status,
    Text,
    Reasoning,
    Tool,
    Approval,
    Source,
    File,
    Error,
    Data,
    Unknown,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RenderedPart {
    pub kind: RenderedPartKind,
    pub label: String,
    pub body: String,
    pub collapsible: bool,
    pub target: Option<String>,
}

/// Project one stream part into a visible, labeled rendering model.
#[must_use]
pub fn render_part(part: &StreamPart) -> RenderedPart {
    match part {
        StreamPart::Known(known) => render_known(known),
        StreamPart::Data { suffix, raw } => RenderedPart {
            kind: RenderedPartKind::Data,
            label: format!("Data: {suffix}"),
            body: pretty(raw),
            collapsible: false,
            target: None,
        },
        StreamPart::Unknown { variant, raw } => RenderedPart {
            kind: RenderedPartKind::Unknown,
            label: format!("Unknown stream part: {variant}"),
            body: pretty(raw),
            collapsible: false,
            target: None,
        },
    }
}

#[allow(clippy::too_many_lines)]
fn render_known(part: &KnownStreamPart) -> RenderedPart {
    match part {
        KnownStreamPart::Start { message_id, .. } => {
            status("Message started", option(message_id.as_ref()))
        }
        KnownStreamPart::TextStart { id, .. } => status("Text started", id.clone()),
        KnownStreamPart::TextDelta { delta, .. } => RenderedPart {
            kind: RenderedPartKind::Text,
            label: "Assistant text".into(),
            body: delta.clone(),
            collapsible: false,
            target: None,
        },
        KnownStreamPart::TextEnd { id, .. } => status("Text finished", id.clone()),
        KnownStreamPart::ReasoningStart { id, .. } => reasoning("Reasoning started", id),
        KnownStreamPart::ReasoningDelta { delta, .. } => reasoning("Reasoning", delta),
        KnownStreamPart::ReasoningEnd { id, .. } => reasoning("Reasoning finished", id),
        KnownStreamPart::ReasoningFile {
            url, media_type, ..
        } => RenderedPart {
            kind: RenderedPartKind::Reasoning,
            label: "Reasoning file".into(),
            body: media_type.clone(),
            collapsible: true,
            target: Some(url.clone()),
        },
        KnownStreamPart::SourceUrl { url, title, .. } => RenderedPart {
            kind: RenderedPartKind::Source,
            label: title.clone().unwrap_or_else(|| "Source URL".into()),
            body: url.clone(),
            collapsible: false,
            target: Some(url.clone()),
        },
        KnownStreamPart::SourceDocument {
            source_id,
            title,
            filename,
            ..
        } => RenderedPart {
            kind: RenderedPartKind::Source,
            label: format!("Document: {title}"),
            body: filename.clone().unwrap_or_else(|| source_id.clone()),
            collapsible: false,
            target: graph_record_target(source_id),
        },
        KnownStreamPart::File {
            url,
            media_type,
            filename,
            ..
        } => RenderedPart {
            kind: RenderedPartKind::File,
            label: filename.clone().unwrap_or_else(|| "File".into()),
            body: media_type.clone(),
            collapsible: false,
            target: Some(url.clone()),
        },
        KnownStreamPart::Custom { kind, .. } => RenderedPart {
            kind: RenderedPartKind::Data,
            label: format!("Custom: {kind}"),
            body: kind.clone(),
            collapsible: false,
            target: None,
        },
        KnownStreamPart::Error { error_text } => error("Run error", error_text),
        KnownStreamPart::ToolInputStart {
            tool_call_id,
            tool_name,
            ..
        } => tool(tool_name, format!("{tool_call_id}: input streaming")),
        KnownStreamPart::ToolInputDelta {
            tool_call_id,
            input_text_delta,
        } => tool("Tool input", format!("{tool_call_id}: {input_text_delta}")),
        KnownStreamPart::ToolInputAvailable {
            tool_call_id,
            tool_name,
            input,
            ..
        } => tool(tool_name, format!("{tool_call_id}\n{}", pretty(input))),
        KnownStreamPart::ToolInputError {
            tool_name,
            error_text,
            input,
            ..
        } => error(
            &format!("{tool_name} input error"),
            &format!("{error_text}\n{}", pretty(input)),
        ),
        KnownStreamPart::ToolApprovalRequest {
            approval_id,
            tool_call_id,
            ..
        } => approval(
            "Approval pending",
            format!("{approval_id} for {tool_call_id}"),
        ),
        KnownStreamPart::ToolApprovalResponse {
            approval_id,
            approved,
            reason,
            ..
        } => approval(
            if *approved {
                "Approval granted"
            } else {
                "Approval denied"
            },
            format!("{approval_id}: {}", option(reason.as_ref())),
        ),
        KnownStreamPart::ToolOutputAvailable {
            tool_call_id,
            output,
            ..
        } => tool("Tool output", format!("{tool_call_id}\n{}", pretty(output))),
        KnownStreamPart::ToolOutputError {
            tool_call_id,
            error_text,
            ..
        } => error(
            "Tool output error",
            &format!("{tool_call_id}: {error_text}"),
        ),
        KnownStreamPart::ToolOutputDenied { tool_call_id } => {
            error("Tool output denied", tool_call_id)
        }
        KnownStreamPart::StartStep => status("Step started", String::new()),
        KnownStreamPart::FinishStep => status("Step finished", String::new()),
        KnownStreamPart::Finish { finish_reason, .. } => {
            status("Run finished", option(finish_reason.as_ref()))
        }
        KnownStreamPart::Abort { reason } => error("Run aborted", &option(reason.as_ref())),
        KnownStreamPart::MessageMetadata { message_metadata } => RenderedPart {
            kind: RenderedPartKind::Data,
            label: "Message metadata".into(),
            body: pretty(message_metadata),
            collapsible: false,
            target: None,
        },
    }
}

fn graph_record_target(source_id: &str) -> Option<String> {
    let (object_type, record_id) = source_id.split_once(':')?;
    (!object_type.is_empty() && !record_id.is_empty()).then(|| format!("record:{source_id}"))
}

fn status(label: &str, body: String) -> RenderedPart {
    RenderedPart {
        kind: RenderedPartKind::Status,
        label: label.into(),
        body,
        collapsible: false,
        target: None,
    }
}

fn reasoning(label: &str, body: &str) -> RenderedPart {
    RenderedPart {
        kind: RenderedPartKind::Reasoning,
        label: label.into(),
        body: body.into(),
        collapsible: true,
        target: None,
    }
}

fn tool(label: &str, body: String) -> RenderedPart {
    RenderedPart {
        kind: RenderedPartKind::Tool,
        label: label.into(),
        body,
        collapsible: false,
        target: None,
    }
}

fn approval(label: &str, body: String) -> RenderedPart {
    RenderedPart {
        kind: RenderedPartKind::Approval,
        label: label.into(),
        body,
        collapsible: false,
        target: None,
    }
}

fn error(label: &str, body: &str) -> RenderedPart {
    RenderedPart {
        kind: RenderedPartKind::Error,
        label: label.into(),
        body: body.into(),
        collapsible: false,
        target: None,
    }
}

fn option(value: Option<&String>) -> String {
    value.cloned().unwrap_or_default()
}

fn pretty(value: &Value) -> String {
    serde_json::to_string_pretty(value).unwrap_or_else(|_| value.to_string())
}

#[derive(Clone, Debug, Eq, PartialEq, Props)]
pub struct ThreadViewProps {
    pub scope: ScopeBinding,
    pub parts: Vec<StreamPart>,
    #[props(default)]
    pub partial: bool,
}

/// Dioxus projection of a thread's active branch.
#[component]
pub fn ThreadView(props: ThreadViewProps) -> Element {
    let chip = ScopeChip::from(&props.scope);
    let rendered = props.parts.iter().map(render_part).collect::<Vec<_>>();
    rsx! {
        section { class: "theorem-agent-thread",
            header {
                button {
                    class: "theorem-scope-chip",
                    "data-scope": "{chip.target.stable_key()}",
                    "{chip.label}"
                }
                if props.partial {
                    span { class: "theorem-partial-label", "Partial response" }
                }
            }
            for (index, part) in rendered.iter().enumerate() {
                article {
                    key: "{index}-{part.label}",
                    class: "theorem-stream-part",
                    "data-part-kind": "{part_kind_name(&part.kind)}",
                    if part.collapsible {
                        details {
                            summary { "{part.label}" }
                            pre { "{part.body}" }
                        }
                    } else {
                        strong { "{part.label}" }
                        pre { "{part.body}" }
                    }
                    if let Some(target) = &part.target {
                        a { href: "{target}", "Open" }
                    }
                }
            }
        }
    }
}

const fn part_kind_name(kind: &RenderedPartKind) -> &'static str {
    match kind {
        RenderedPartKind::Status => "status",
        RenderedPartKind::Text => "text",
        RenderedPartKind::Reasoning => "reasoning",
        RenderedPartKind::Tool => "tool",
        RenderedPartKind::Approval => "approval",
        RenderedPartKind::Source => "source",
        RenderedPartKind::File => "file",
        RenderedPartKind::Error => "error",
        RenderedPartKind::Data => "data",
        RenderedPartKind::Unknown => "unknown",
    }
}

#[cfg(test)]
mod tests {
    use crate::{parse_sse_stream, SseEvent};

    use super::*;

    fn all_parts() -> Vec<StreamPart> {
        parse_sse_stream(include_str!("../../fixtures/all-parts.sse"))
            .unwrap()
            .into_iter()
            .filter_map(|event| match event {
                SseEvent::Part(part) => Some(part),
                _ => None,
            })
            .collect()
    }

    #[test]
    fn all_parts_have_a_visible_projection() {
        let parts = all_parts();
        let rendered = parts.iter().map(render_part).collect::<Vec<_>>();
        assert_eq!(rendered.len(), parts.len());
        assert!(rendered.iter().all(|part| !part.label.is_empty()));
        assert!(rendered
            .iter()
            .any(|part| part.label == "Data: weather" && part.body.contains("70")));
        assert!(rendered
            .iter()
            .any(|part| part.label == "Unknown stream part: future-control"));
        assert!(rendered
            .iter()
            .any(|part| part.kind == RenderedPartKind::Reasoning && part.collapsible));
    }

    #[test]
    fn dioxus_thread_view_renders_scope_partial_and_affordances() {
        let html = dioxus_ssr::render_element(rsx! {
            ThreadView {
                scope: ScopeBinding::Record {
                    object_type: "company".into(),
                    record_id: "acme".into(),
                },
                parts: all_parts(),
                partial: true,
            }
        });
        assert!(html.contains("company acme"));
        assert!(html.contains("Partial response"));
        assert!(html.contains("Approval pending"));
        assert!(html.contains("Data: weather"));
        assert!(html.contains("Unknown stream part: future-control"));
    }
}
