use serde::{de::Error as _, Deserialize, Deserializer, Serialize, Serializer};
use serde_json::{json, Map, Value};

#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ScopeBinding {
    Workspace,
    Canvas {
        canvas_id: String,
    },
    Node {
        node_id: String,
    },
    Record {
        object_type: String,
        record_id: String,
    },
    Document {
        document_id: String,
    },
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct RecordRef {
    pub object_type: String,
    pub record_id: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct ScopeContext {
    pub binding: ScopeBinding,
    #[serde(default)]
    pub records: Vec<RecordRef>,
    #[serde(default)]
    pub documents: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thread_id: Option<String>,
    #[serde(default)]
    pub capability_grants: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Renderer {
    Dioxus(String),
    Servo(String),
    SystemWebview(String),
    Unavailable { variant: String, raw: Value },
}

impl Renderer {
    #[must_use]
    pub fn unavailable_label(&self) -> Option<String> {
        match self {
            Self::Unavailable { variant, .. } => Some(format!("Unavailable renderer: {variant}")),
            _ => None,
        }
    }

    #[must_use]
    pub fn body_kind(&self) -> Option<&str> {
        match self {
            Self::Dioxus(body_kind) => Some(body_kind),
            _ => None,
        }
    }
}

impl Serialize for Renderer {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let value = match self {
            Self::Dioxus(body_kind) => json!({"kind": "dioxus", "body_kind": body_kind}),
            Self::Servo(url) => json!({"kind": "servo", "url": url}),
            Self::SystemWebview(url) => json!({"kind": "system_webview", "url": url}),
            Self::Unavailable { variant, raw } => {
                let mut object = raw.as_object().cloned().unwrap_or_default();
                object.insert("kind".into(), Value::String(variant.clone()));
                Value::Object(object)
            }
        };
        value.serialize(serializer)
    }
}

impl<'de> Deserialize<'de> for Renderer {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = Value::deserialize(deserializer)?;
        let object = value
            .as_object()
            .ok_or_else(|| D::Error::custom("renderer must be an object"))?;
        let kind = object
            .get("kind")
            .and_then(Value::as_str)
            .ok_or_else(|| D::Error::custom("renderer.kind must be a string"))?;
        match kind {
            "dioxus" => required_string(object, "body_kind", kind)
                .map(Self::Dioxus)
                .map_err(D::Error::custom),
            "servo" => required_string(object, "url", kind)
                .map(Self::Servo)
                .map_err(D::Error::custom),
            "system_webview" => required_string(object, "url", kind)
                .map(Self::SystemWebview)
                .map_err(D::Error::custom),
            variant => Ok(Self::Unavailable {
                variant: variant.to_owned(),
                raw: value,
            }),
        }
    }
}

fn required_string(object: &Map<String, Value>, key: &str, kind: &str) -> Result<String, String> {
    object
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_owned)
        .ok_or_else(|| format!("{kind} renderer needs {key}"))
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct SurfaceSpec {
    pub surface_id: String,
    pub title: String,
    pub icon: String,
    pub default_scope: ScopeBinding,
    pub renderer: Renderer,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fallback_renderer: Option<Renderer>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub layout_ref: Option<String>,
    #[serde(default)]
    pub capabilities: Vec<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct SurfaceListResponse {
    pub surfaces: Vec<SurfaceSpec>,
    pub count: usize,
}
