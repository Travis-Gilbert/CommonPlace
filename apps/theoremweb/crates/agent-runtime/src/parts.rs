//! AI SDK 5 UI-message stream parts.
//!
//! Known parts are decoded into [`KnownStreamPart`]. Custom `data-*` and
//! future non-data variants retain their complete JSON object separately so a
//! renderer can label both without silently dropping either class.

use serde::{de::Error as _, Deserialize, Deserializer, Serialize, Serializer};
use serde_json::Value;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum KnownStreamPart {
    #[serde(rename = "start")]
    Start {
        #[serde(rename = "messageId", default)]
        message_id: Option<String>,
        #[serde(rename = "messageMetadata", default)]
        message_metadata: Option<Value>,
    },
    #[serde(rename = "text-start")]
    TextStart {
        id: String,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "text-delta")]
    TextDelta {
        id: String,
        delta: String,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "text-end")]
    TextEnd {
        id: String,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "reasoning-start")]
    ReasoningStart {
        id: String,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "reasoning-delta")]
    ReasoningDelta {
        id: String,
        delta: String,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "reasoning-end")]
    ReasoningEnd {
        id: String,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "reasoning-file")]
    ReasoningFile {
        url: String,
        #[serde(rename = "mediaType")]
        media_type: String,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "source-url")]
    SourceUrl {
        #[serde(rename = "sourceId")]
        source_id: String,
        url: String,
        #[serde(default)]
        title: Option<String>,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "source-document")]
    SourceDocument {
        #[serde(rename = "sourceId")]
        source_id: String,
        #[serde(rename = "mediaType")]
        media_type: String,
        title: String,
        #[serde(default)]
        filename: Option<String>,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "file")]
    File {
        url: String,
        #[serde(rename = "mediaType")]
        media_type: String,
        #[serde(default)]
        filename: Option<String>,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "custom")]
    Custom {
        kind: String,
        #[serde(rename = "providerMetadata", default)]
        provider_metadata: Option<Value>,
    },
    #[serde(rename = "error")]
    Error {
        #[serde(rename = "errorText")]
        error_text: String,
    },
    #[serde(rename = "tool-input-start")]
    ToolInputStart {
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
        #[serde(rename = "toolName")]
        tool_name: String,
        #[serde(flatten)]
        rest: serde_json::Map<String, Value>,
    },
    #[serde(rename = "tool-input-delta")]
    ToolInputDelta {
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
        #[serde(rename = "inputTextDelta")]
        input_text_delta: String,
    },
    #[serde(rename = "tool-input-available")]
    ToolInputAvailable {
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
        #[serde(rename = "toolName")]
        tool_name: String,
        #[serde(default)]
        input: Value,
        #[serde(flatten)]
        rest: serde_json::Map<String, Value>,
    },
    #[serde(rename = "tool-input-error")]
    ToolInputError {
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
        #[serde(rename = "toolName")]
        tool_name: String,
        #[serde(default)]
        input: Value,
        #[serde(rename = "errorText")]
        error_text: String,
        #[serde(flatten)]
        rest: serde_json::Map<String, Value>,
    },
    #[serde(rename = "tool-approval-request")]
    ToolApprovalRequest {
        #[serde(rename = "approvalId")]
        approval_id: String,
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
        #[serde(rename = "isAutomatic", default)]
        is_automatic: Option<bool>,
        #[serde(default)]
        signature: Option<String>,
    },
    #[serde(rename = "tool-approval-response")]
    ToolApprovalResponse {
        #[serde(rename = "approvalId")]
        approval_id: String,
        approved: bool,
        #[serde(default)]
        reason: Option<String>,
        #[serde(flatten)]
        rest: serde_json::Map<String, Value>,
    },
    #[serde(rename = "tool-output-available")]
    ToolOutputAvailable {
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
        #[serde(default)]
        output: Value,
        #[serde(flatten)]
        rest: serde_json::Map<String, Value>,
    },
    #[serde(rename = "tool-output-error")]
    ToolOutputError {
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
        #[serde(rename = "errorText")]
        error_text: String,
        #[serde(flatten)]
        rest: serde_json::Map<String, Value>,
    },
    #[serde(rename = "tool-output-denied")]
    ToolOutputDenied {
        #[serde(rename = "toolCallId")]
        tool_call_id: String,
    },
    #[serde(rename = "start-step")]
    StartStep,
    #[serde(rename = "finish-step")]
    FinishStep,
    #[serde(rename = "finish")]
    Finish {
        #[serde(rename = "finishReason", default)]
        finish_reason: Option<String>,
        #[serde(rename = "messageMetadata", default)]
        message_metadata: Option<Value>,
    },
    #[serde(rename = "abort")]
    Abort {
        #[serde(default)]
        reason: Option<String>,
    },
    #[serde(rename = "message-metadata")]
    MessageMetadata {
        #[serde(rename = "messageMetadata")]
        message_metadata: Value,
    },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StreamPart {
    Known(KnownStreamPart),
    Data { suffix: String, raw: Value },
    Unknown { variant: String, raw: Value },
}

impl StreamPart {
    #[must_use]
    pub fn variant(&self) -> &str {
        match self {
            Self::Known(known) => known.variant(),
            Self::Data { suffix, .. } => suffix,
            Self::Unknown { variant, .. } => variant,
        }
    }
}

impl KnownStreamPart {
    #[must_use]
    pub const fn variant(&self) -> &'static str {
        match self {
            Self::Start { .. } => "start",
            Self::TextStart { .. } => "text-start",
            Self::TextDelta { .. } => "text-delta",
            Self::TextEnd { .. } => "text-end",
            Self::ReasoningStart { .. } => "reasoning-start",
            Self::ReasoningDelta { .. } => "reasoning-delta",
            Self::ReasoningEnd { .. } => "reasoning-end",
            Self::ReasoningFile { .. } => "reasoning-file",
            Self::SourceUrl { .. } => "source-url",
            Self::SourceDocument { .. } => "source-document",
            Self::File { .. } => "file",
            Self::Custom { .. } => "custom",
            Self::Error { .. } => "error",
            Self::ToolInputStart { .. } => "tool-input-start",
            Self::ToolInputDelta { .. } => "tool-input-delta",
            Self::ToolInputAvailable { .. } => "tool-input-available",
            Self::ToolInputError { .. } => "tool-input-error",
            Self::ToolApprovalRequest { .. } => "tool-approval-request",
            Self::ToolApprovalResponse { .. } => "tool-approval-response",
            Self::ToolOutputAvailable { .. } => "tool-output-available",
            Self::ToolOutputError { .. } => "tool-output-error",
            Self::ToolOutputDenied { .. } => "tool-output-denied",
            Self::StartStep => "start-step",
            Self::FinishStep => "finish-step",
            Self::Finish { .. } => "finish",
            Self::Abort { .. } => "abort",
            Self::MessageMetadata { .. } => "message-metadata",
        }
    }
}

impl<'de> Deserialize<'de> for StreamPart {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let raw = Value::deserialize(deserializer)?;
        let variant = raw
            .get("type")
            .and_then(Value::as_str)
            .ok_or_else(|| D::Error::custom("stream part type must be a string"))?;
        match serde_json::from_value::<KnownStreamPart>(raw.clone()) {
            Ok(known) => return Ok(Self::Known(known)),
            Err(error) if is_known_variant(variant) => return Err(D::Error::custom(error)),
            Err(_) => {}
        }
        if let Some(suffix) = variant.strip_prefix("data-") {
            return Ok(Self::Data {
                suffix: suffix.to_owned(),
                raw,
            });
        }
        Ok(Self::Unknown {
            variant: variant.to_owned(),
            raw,
        })
    }
}

fn is_known_variant(variant: &str) -> bool {
    matches!(
        variant,
        "start"
            | "text-start"
            | "text-delta"
            | "text-end"
            | "reasoning-start"
            | "reasoning-delta"
            | "reasoning-end"
            | "reasoning-file"
            | "source-url"
            | "source-document"
            | "file"
            | "custom"
            | "error"
            | "tool-input-start"
            | "tool-input-delta"
            | "tool-input-available"
            | "tool-input-error"
            | "tool-approval-request"
            | "tool-approval-response"
            | "tool-output-available"
            | "tool-output-error"
            | "tool-output-denied"
            | "start-step"
            | "finish-step"
            | "finish"
            | "abort"
            | "message-metadata"
    )
}

impl Serialize for StreamPart {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match self {
            Self::Known(known) => known.serialize(serializer),
            Self::Data { raw, .. } | Self::Unknown { raw, .. } => raw.serialize(serializer),
        }
    }
}

/// Decode one JSON UI-message stream part.
///
/// # Errors
///
/// Returns Serde's error when the value is not JSON or has no string `type`.
pub fn parse_part_json(input: &str) -> Result<StreamPart, serde_json::Error> {
    serde_json::from_str(input)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn current_approval_shape_requires_both_ids() {
        let part = parse_part_json(
            r#"{"type":"tool-approval-request","approvalId":"approval-1","toolCallId":"call-1"}"#,
        )
        .unwrap();
        assert!(matches!(
            part,
            StreamPart::Known(KnownStreamPart::ToolApprovalRequest {
                approval_id,
                tool_call_id,
                ..
            }) if approval_id == "approval-1" && tool_call_id == "call-1"
        ));
    }

    #[test]
    fn data_and_unknown_variants_are_distinct_and_round_trip() {
        let data_wire = json!({"type": "data-weather", "data": {"temp": 70}});
        let unknown_wire = json!({"type": "future-control", "mode": "safe"});
        let data: StreamPart = serde_json::from_value(data_wire.clone()).unwrap();
        let unknown: StreamPart = serde_json::from_value(unknown_wire.clone()).unwrap();
        assert!(matches!(data, StreamPart::Data { ref suffix, .. } if suffix == "weather"));
        assert!(
            matches!(unknown, StreamPart::Unknown { ref variant, .. } if variant == "future-control")
        );
        assert_eq!(serde_json::to_value(data).unwrap(), data_wire);
        assert_eq!(serde_json::to_value(unknown).unwrap(), unknown_wire);
    }
}
