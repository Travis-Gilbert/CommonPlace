//! Shared HTTP serving surface for the CommonPlace API.
//!
//! The standalone binary and the desktop embedder both serve the same GraphQL
//! contract. The binary uses environment-driven configuration; the desktop uses
//! [`serve_loopback`] with a durable local data directory and graceful shutdown.
//!
//! Alongside `/graphql`, both routers expose the canonical capture seam:
//! `POST /ingest/capture` accepts JSON or multipart [`CaptureEnvelope`] values,
//! while legacy multipart `POST /ingest/blob` adapts into that same path.
//! `GET /blob/{hash}` returns captured bytes. All routes share one API-key
//! registry and accept either `x-api-key` or its Bearer equivalent.

use std::collections::BTreeMap;
use std::future::Future;
use std::net::SocketAddr;
use std::path::Path;
use std::sync::{mpsc::SyncSender, Arc};

use async_graphql::http::GraphiQLSource;
use async_graphql::{EmptySubscription, Request, Schema};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::extract::{
    DefaultBodyLimit, FromRequest, Multipart, Path as AxumPath, Request as AxumRequest, State,
};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use commonplace::{
    content_hash, BlobStore, EmbeddingGraphStore, IngestBody, IngestInput, IngestPipeline, Item,
    ItemBody, ItemKind, ObjectAction, ObjectActionReceipt, ObjectQuery, ObjectSet, Residency,
    SourceRef, ViewDescriptor,
};
use rustyred_thg_core::{GraphSnapshotSource, NodeRecord};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

use crate::voice::{Transcriber, Voice};
use crate::{
    answer_model_from_env, build_schema, build_schema_with_model, in_memory_store, redcore_store,
    AnswerModel, ApiKeyRegistry, ApiKeyToken, Mutation, Principal, Query, SharedStore,
};

/// PT-017: cap multipart capture bodies (photo/file/voice) at 32MB.
const BLOB_BODY_LIMIT_BYTES: usize = 32 * 1024 * 1024;
const MAX_CAPTURE_ATTACHMENTS: usize = 32;

struct AppState<S, B>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    schema: Schema<Query<S, B>, Mutation<S, B>, EmptySubscription>,
    registry: Arc<ApiKeyRegistry>,
    store: SharedStore<S, B>,
}

impl<S, B> Clone for AppState<S, B>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    fn clone(&self) -> Self {
        Self {
            schema: self.schema.clone(),
            registry: Arc::clone(&self.registry),
            store: Arc::clone(&self.store),
        }
    }
}

pub fn build_router<S, B>(store: SharedStore<S, B>, registry: Arc<ApiKeyRegistry>) -> Router
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    let schema = build_schema(Arc::clone(&store), Arc::clone(&registry));
    build_public_router_from_schema(schema, registry, store)
}

pub fn build_router_with_model<S, B>(
    store: SharedStore<S, B>,
    registry: Arc<ApiKeyRegistry>,
    model: Arc<dyn AnswerModel>,
) -> Router
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    let schema = build_schema_with_model(Arc::clone(&store), Arc::clone(&registry), model);
    build_public_router_from_schema(schema, registry, store)
}

fn build_public_router_from_schema<S, B>(
    schema: Schema<Query<S, B>, Mutation<S, B>, EmptySubscription>,
    registry: Arc<ApiKeyRegistry>,
    store: SharedStore<S, B>,
) -> Router
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    let state = AppState {
        schema,
        registry,
        store,
    };
    Router::new()
        .route("/healthz", get(healthz))
        .route("/graphql", get(graphiql).post(graphql_handler::<S, B>))
        .merge(blob_routes::<S, B>())
        .merge(object_routes::<S, B>())
        .layer(CorsLayer::permissive())
        .with_state(state)
}

fn build_loopback_router_from_schema<S, B>(
    schema: Schema<Query<S, B>, Mutation<S, B>, EmptySubscription>,
    registry: Arc<ApiKeyRegistry>,
    store: SharedStore<S, B>,
) -> Router
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    let state = AppState {
        schema,
        registry,
        store,
    };
    Router::new()
        .route("/healthz", get(healthz))
        .route("/graphql", post(graphql_handler::<S, B>))
        .merge(blob_routes::<S, B>())
        .merge(object_routes::<S, B>())
        .with_state(state)
}

/// The PT-017 blob capture routes, shared by the public and loopback routers.
fn blob_routes<S, B>() -> Router<AppState<S, B>>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    Router::new()
        .route(
            "/ingest/capture",
            post(ingest_capture_handler::<S, B>)
                .layer(DefaultBodyLimit::max(BLOB_BODY_LIMIT_BYTES)),
        )
        .route(
            "/ingest/blob",
            post(ingest_blob_handler::<S, B>).layer(DefaultBodyLimit::max(BLOB_BODY_LIMIT_BYTES)),
        )
        .route("/blob/{hash}", get(blob_get_handler::<S, B>))
        .route("/capabilities", get(capabilities_handler::<S, B>))
        .route("/mobile/catalog", get(mobile_catalog_handler::<S, B>))
        .route("/tts", post(tts_handler::<S, B>))
}

#[derive(Serialize)]
struct NativeCapabilities {
    voice_capture: bool,
    voice_readback: bool,
    chat_attachments: bool,
    chat_url: Option<String>,
    web_search: bool,
    push_registration_url: Option<String>,
    expo_project_id: Option<String>,
    capability_catalog: bool,
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct NativeCatalogEntry {
    id: String,
    kind: String,
    name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    description: Option<String>,
}

#[derive(Serialize)]
struct NativeCapabilityCatalog {
    plugins: Vec<NativeCatalogEntry>,
    skills: Vec<NativeCatalogEntry>,
}

/// Safe capability discovery for native clients. Provider names and secrets
/// stay server-side; the client only learns whether an affordance is real.
async fn capabilities_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
) -> Result<Json<NativeCapabilities>, StatusCode>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    authorize(&state, &headers)?;
    Ok(Json(NativeCapabilities {
        voice_capture: Transcriber::from_env().is_enabled(),
        voice_readback: Voice::from_env().is_ok(),
        // This must only be enabled when the configured hosted ACP route
        // consumes file and image content parts instead of dropping them.
        chat_attachments: env_flag("COMMONPLACE_CHAT_ATTACHMENTS"),
        chat_url: env_value("COMMONPLACE_CHAT_URL"),
        web_search: env_flag("COMMONPLACE_WEB_SEARCH"),
        push_registration_url: env_value("COMMONPLACE_PUSH_REGISTRATION_URL"),
        expo_project_id: env_value("COMMONPLACE_EXPO_PROJECT_ID"),
        capability_catalog: true,
    }))
}

/// Installed or configured plugins and skills available to the connected
/// runtime. The normalized response lets native clients select an exact id
/// instead of relying on an unvalidated name typed into the prompt.
async fn mobile_catalog_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
) -> Result<Json<NativeCapabilityCatalog>, StatusCode>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    authorize(&state, &headers)?;
    let store = state
        .store
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let mut entries = BTreeMap::<(String, String), NativeCatalogEntry>::new();
    for kind in ["plugin", "skill"] {
        for item in store
            .items_by_kind(&ItemKind::from(kind.to_string()))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        {
            if item
                .extra
                .get("enabled")
                .and_then(serde_json::Value::as_bool)
                == Some(false)
            {
                continue;
            }
            let description = item
                .extra
                .get("description")
                .and_then(serde_json::Value::as_str)
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
                .or_else(|| match &item.body {
                    ItemBody::Inline { text } if !text.trim().is_empty() => {
                        Some(text.trim().to_string())
                    }
                    _ => None,
                });
            let entry = NativeCatalogEntry {
                id: item.id,
                kind: kind.to_string(),
                name: item.title,
                description,
            };
            entries.insert((entry.kind.clone(), entry.id.clone()), entry);
        }
    }
    for entry in configured_catalog_entries() {
        entries.insert((entry.kind.clone(), entry.id.clone()), entry);
    }
    let mut plugins = Vec::new();
    let mut skills = Vec::new();
    for entry in entries.into_values() {
        match entry.kind.as_str() {
            "plugin" => plugins.push(entry),
            "skill" => skills.push(entry),
            _ => {}
        }
    }
    plugins.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    skills.sort_by(|left, right| left.name.cmp(&right.name).then(left.id.cmp(&right.id)));
    Ok(Json(NativeCapabilityCatalog { plugins, skills }))
}

fn configured_catalog_entries() -> Vec<NativeCatalogEntry> {
    let Some(raw) = env_value("COMMONPLACE_MOBILE_CATALOG_JSON") else {
        return Vec::new();
    };
    serde_json::from_str::<Vec<NativeCatalogEntry>>(&raw)
        .unwrap_or_default()
        .into_iter()
        .filter(|entry| {
            !entry.id.trim().is_empty()
                && !entry.name.trim().is_empty()
                && matches!(entry.kind.as_str(), "plugin" | "skill")
        })
        .collect()
}

fn env_value(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn env_flag(name: &str) -> bool {
    env_value(name).is_some_and(|value| value == "1" || value.eq_ignore_ascii_case("true"))
}

/// The block-view object-model seam over HTTP (SPEC-OBJECT-CONTRACT-V2). The web
/// `HttpBlockHost` reaches the same `query_object_set` / `emit_object_action` /
/// registry the Rust `CommonplaceBlockHost` uses, so a surface renders live from
/// the substrate with nothing above the `BlockHost` seam changing.
fn object_routes<S, B>() -> Router<AppState<S, B>>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    Router::new()
        .route("/objects/query", post(objects_query_handler::<S, B>))
        .route("/objects/action", post(objects_action_handler::<S, B>))
        .route("/objects/views", get(objects_views_handler::<S, B>))
}

async fn objects_query_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
    Json(query): Json<ObjectQuery>,
) -> Result<Json<ObjectSet>, StatusCode>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    authorize(&state, &headers)?;
    let store = state
        .store
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let set = store
        .query_object_set(query)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    Ok(Json(set))
}

async fn objects_action_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
    Json(action): Json<ObjectAction>,
) -> Result<Json<ObjectActionReceipt>, StatusCode>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    authorize(&state, &headers)?;
    let actor = headers
        .get("x-actor-id")
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let mut store = state
        .store
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let receipt = store
        .emit_object_action(action, actor)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    Ok(Json(receipt))
}

async fn objects_views_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
) -> Result<Json<Vec<ViewDescriptor>>, StatusCode>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    authorize(&state, &headers)?;
    let store = state
        .store
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let registry = store
        .load_view_registry()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(registry.descriptors().to_vec()))
}

async fn healthz() -> &'static str {
    "ok"
}

async fn graphiql() -> impl IntoResponse {
    Html(GraphiQLSource::build().endpoint("/graphql").finish())
}

/// Resolve either supported spelling of the same API key.
///
/// When callers send both forms they must agree. Refusing an ambiguous request
/// avoids authenticating one credential while a proxy or log records another.
fn presented_api_key(headers: &HeaderMap) -> Option<&str> {
    let direct = headers
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let bearer = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| {
            let (scheme, token) = value.trim().split_once(' ')?;
            scheme
                .eq_ignore_ascii_case("bearer")
                .then_some(token.trim())
        })
        .filter(|value| !value.is_empty());

    match (direct, bearer) {
        (Some(left), Some(right)) if left == right => Some(left),
        (Some(_), Some(_)) => None,
        (Some(key), None) | (None, Some(key)) => Some(key),
        (None, None) => None,
    }
}

/// The API-key gate shared by GraphQL, capture, blob, and object routes.
fn authorize<S, B>(state: &AppState<S, B>, headers: &HeaderMap) -> Result<Principal, StatusCode>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    presented_api_key(headers)
        .and_then(|key| state.registry.resolve(key))
        .cloned()
        .ok_or(StatusCode::FORBIDDEN)
}

async fn graphql_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
    req: GraphQLRequest,
) -> Result<GraphQLResponse, StatusCode>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    authorize(&state, &headers)?;
    let key = presented_api_key(&headers).ok_or(StatusCode::FORBIDDEN)?;

    let request: Request = req.into_inner().data(ApiKeyToken(key.to_string()));
    Ok(state.schema.execute(request).await.into())
}

macro_rules! flexible_string_enum {
    (
        $(#[$meta:meta])*
        pub enum $name:ident {
            $($variant:ident => $value:literal),+ $(,)?
        }
    ) => {
        $(#[$meta])*
        #[derive(Clone, Debug, PartialEq, Eq)]
        pub enum $name {
            $($variant,)+
            Other(String),
        }

        impl $name {
            fn as_str(&self) -> &str {
                match self {
                    $(Self::$variant => $value,)+
                    Self::Other(value) => value,
                }
            }
        }

        impl Serialize for $name {
            fn serialize<Serializer>(
                &self,
                serializer: Serializer,
            ) -> Result<Serializer::Ok, Serializer::Error>
            where
                Serializer: serde::Serializer,
            {
                serializer.serialize_str(self.as_str())
            }
        }

        impl<'de> Deserialize<'de> for $name {
            fn deserialize<Deserializer>(
                deserializer: Deserializer,
            ) -> Result<Self, Deserializer::Error>
            where
                Deserializer: serde::Deserializer<'de>,
            {
                let value = String::deserialize(deserializer)?;
                let normalized = value.trim().to_ascii_lowercase();
                Ok(match normalized.as_str() {
                    $($value => Self::$variant,)+
                    _ => Self::Other(normalized),
                })
            }
        }
    };
}

flexible_string_enum! {
    /// How a person or agent produced a capture.
    pub enum CaptureMethod {
        Clipped => "clipped",
        Composed => "composed",
        Dropped => "dropped",
        Agent => "agent",
        Screen => "screen",
        Voice => "voice",
    }
}

flexible_string_enum! {
    /// The client-facing object category requested for a capture.
    pub enum ObjectType {
        Source => "source",
        Note => "note",
        Clip => "clip",
        Screen => "screen",
        File => "file",
    }
}

flexible_string_enum! {
    /// The surface that submitted a capture.
    pub enum CaptureSource {
        Clipper => "clipper",
        Pet => "pet",
        Mobile => "mobile",
        Console => "console",
        Agent => "agent",
        Api => "api",
    }
}

/// An attachment already present in the content-addressed blob store.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct AttachmentRef {
    #[serde(alias = "blobHash", alias = "content_hash", alias = "contentHash")]
    pub blob_hash: String,
    #[serde(default, alias = "fileName")]
    pub file_name: Option<String>,
    #[serde(default)]
    pub mime: Option<String>,
}

/// The single capture contract shared by every capture surface.
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct CaptureEnvelope {
    #[serde(alias = "clientId")]
    pub client_id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub body: String,
    #[serde(alias = "objectType")]
    pub object_type: ObjectType,
    #[serde(alias = "captureMethod")]
    pub capture_method: CaptureMethod,
    pub source: CaptureSource,
    #[serde(alias = "capturedAt")]
    pub captured_at: String,
    #[serde(default, alias = "sourceUrl")]
    pub source_url: Option<String>,
    #[serde(default, alias = "kindHint")]
    pub kind_hint: Option<String>,
    #[serde(default)]
    pub properties: BTreeMap<String, String>,
    #[serde(default)]
    pub attachments: Vec<AttachmentRef>,
    #[serde(default, alias = "idempotencyKey")]
    pub idempotency_key: Option<String>,
}

/// ItemGql-compatible capture receipt plus capture-specific retry metadata.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureIngestResponse {
    id: String,
    kind: String,
    title: String,
    body_text: Option<String>,
    blob_hash: Option<String>,
    mime: Option<String>,
    source: Option<String>,
    residency: String,
    tags: Vec<String>,
    collections: Vec<String>,
    classification: Option<String>,
    status: Option<String>,
    priority: Option<String>,
    due_at_ms: Option<i64>,
    remind_at_ms: Option<i64>,
    path: Option<String>,
    extra: serde_json::Value,
    created_at_ms: i64,
    updated_at_ms: i64,
    created: bool,
    client_id: String,
}

impl CaptureIngestResponse {
    fn from_item(item: Item, created: bool, client_id: String) -> Self {
        let (body_text, blob_hash, mime) = match &item.body {
            ItemBody::Inline { text } => (Some(text.clone()), None, None),
            ItemBody::Blob {
                content_hash, mime, ..
            } => (None, Some(content_hash.clone()), mime.clone()),
            ItemBody::Empty => (None, None, None),
        };
        let path = item
            .extra
            .get("path")
            .or_else(|| item.extra.get("folder_path"))
            .and_then(serde_json::Value::as_str)
            .map(str::to_string);
        Self {
            id: item.id,
            kind: item.kind.as_str().to_string(),
            title: item.title,
            body_text,
            blob_hash,
            mime,
            source: item.source,
            residency: item.residency.as_str().to_string(),
            tags: item.tags,
            collections: item.collections,
            classification: item.classification,
            status: item.status,
            priority: item.priority,
            due_at_ms: item.due_at_ms,
            remind_at_ms: item.remind_at_ms,
            path,
            extra: serde_json::Value::Object(item.extra),
            created_at_ms: item.created_at_ms,
            updated_at_ms: item.updated_at_ms,
            created,
            client_id,
        }
    }
}

#[derive(Clone, Debug)]
struct UploadedAttachment {
    bytes: Vec<u8>,
    file_name: Option<String>,
    mime: Option<String>,
}

#[derive(Clone, Debug)]
struct ResolvedAttachment {
    reference: AttachmentRef,
    bytes: Vec<u8>,
}

fn capture_item_kind(envelope: &CaptureEnvelope, mime: Option<&str>) -> ItemKind {
    if let Some(hint) = envelope
        .kind_hint
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        return blob_item_kind(Some(hint), mime);
    }
    ItemKind::from(envelope.object_type.as_str().to_string())
}

fn append_hash_component(buffer: &mut Vec<u8>, value: &[u8]) {
    buffer.extend_from_slice(&(value.len() as u64).to_be_bytes());
    buffer.extend_from_slice(value);
}

fn capture_marker_id(
    tenant: &str,
    envelope: &CaptureEnvelope,
    uploads: &[UploadedAttachment],
    upload_hashes: &[String],
) -> String {
    let requested_key = envelope
        .idempotency_key
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| {
            let mut identity = b"capture-envelope-v1".to_vec();
            append_hash_component(&mut identity, envelope.body.as_bytes());
            append_hash_component(
                &mut identity,
                envelope.title.as_deref().unwrap_or_default().as_bytes(),
            );
            append_hash_component(&mut identity, envelope.object_type.as_str().as_bytes());
            append_hash_component(&mut identity, envelope.capture_method.as_str().as_bytes());
            append_hash_component(&mut identity, envelope.source.as_str().as_bytes());
            append_hash_component(&mut identity, envelope.captured_at.as_bytes());
            append_hash_component(
                &mut identity,
                envelope
                    .source_url
                    .as_deref()
                    .unwrap_or_default()
                    .as_bytes(),
            );
            append_hash_component(
                &mut identity,
                envelope.kind_hint.as_deref().unwrap_or_default().as_bytes(),
            );
            for (key, value) in &envelope.properties {
                append_hash_component(&mut identity, key.as_bytes());
                append_hash_component(&mut identity, value.as_bytes());
            }
            for attachment in &envelope.attachments {
                append_hash_component(&mut identity, attachment.blob_hash.as_bytes());
                append_hash_component(
                    &mut identity,
                    attachment
                        .file_name
                        .as_deref()
                        .unwrap_or_default()
                        .as_bytes(),
                );
                append_hash_component(
                    &mut identity,
                    attachment.mime.as_deref().unwrap_or_default().as_bytes(),
                );
            }
            for (upload, upload_hash) in uploads.iter().zip(upload_hashes) {
                append_hash_component(&mut identity, upload_hash.as_bytes());
                append_hash_component(
                    &mut identity,
                    upload.file_name.as_deref().unwrap_or_default().as_bytes(),
                );
                append_hash_component(
                    &mut identity,
                    upload.mime.as_deref().unwrap_or_default().as_bytes(),
                );
            }
            content_hash(&identity)
        });
    let effective_key =
        content_hash(format!("{tenant}\0{}\0{requested_key}", envelope.client_id).as_bytes());
    format!(
        "capture-idempotency:{}",
        effective_key.trim_start_matches("sha256:")
    )
}

fn existing_capture<S, B>(
    state: &AppState<S, B>,
    marker_id: &str,
    client_id: &str,
) -> Result<Option<CaptureIngestResponse>, (StatusCode, String)>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    let cp = state.store.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "store lock poisoned".to_string(),
        )
    })?;
    let Some(marker) = cp.store().get_node(marker_id) else {
        let recovered = cp
            .item_by_source_ref("commonplace:capture-idempotency", marker_id)
            .map_err(internal_store_error)?;
        return Ok(recovered
            .map(|item| CaptureIngestResponse::from_item(item, false, client_id.to_string())));
    };
    let target_id = marker
        .properties
        .get("target_id")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "capture idempotency marker has no target".to_string(),
            )
        })?;
    let item = cp
        .get_item(target_id)
        .map_err(internal_store_error)?
        .ok_or_else(|| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "capture idempotency target is missing".to_string(),
            )
        })?;
    Ok(Some(CaptureIngestResponse::from_item(
        item,
        false,
        client_id.to_string(),
    )))
}

fn internal_store_error(error: impl std::fmt::Debug) -> (StatusCode, String) {
    eprintln!("capture store failed: {error:?}");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "capture store failed".to_string(),
    )
}

async fn ingest_capture_handler<S, B>(
    State(state): State<AppState<S, B>>,
    request: AxumRequest,
) -> Result<Json<CaptureIngestResponse>, (StatusCode, String)>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    let headers = request.headers().clone();
    let principal =
        authorize(&state, &headers).map_err(|status| (status, "invalid API key".to_string()))?;
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let (envelope, uploads) = if content_type.starts_with("application/json") {
        let Json(envelope) = Json::<CaptureEnvelope>::from_request(request, &state)
            .await
            .map_err(|error| (StatusCode::BAD_REQUEST, error.to_string()))?;
        (envelope, Vec::new())
    } else if content_type.starts_with("multipart/form-data") {
        let mut multipart = Multipart::from_request(request, &state)
            .await
            .map_err(|error| (StatusCode::BAD_REQUEST, error.to_string()))?;
        parse_capture_multipart(&mut multipart).await?
    } else {
        return Err((
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "Content-Type must be application/json or multipart/form-data".to_string(),
        ));
    };

    ingest_capture_inner(&state, &principal.id, envelope, uploads)
        .await
        .map(Json)
}

async fn parse_capture_multipart(
    multipart: &mut Multipart,
) -> Result<(CaptureEnvelope, Vec<UploadedAttachment>), (StatusCode, String)> {
    let mut envelope = None;
    let mut uploads = Vec::new();
    while let Some(field) = multipart.next_field().await.map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            format!("invalid multipart body: {error}"),
        )
    })? {
        match field.name().unwrap_or_default() {
            "capture" => {
                let bytes = field.bytes().await.map_err(bad_field)?;
                envelope = Some(serde_json::from_slice(&bytes).map_err(|error| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("invalid capture envelope: {error}"),
                    )
                })?);
            }
            "file" => {
                let file_name = field.file_name().map(str::to_string);
                let mime = field.content_type().map(str::to_string);
                let bytes = field.bytes().await.map_err(bad_field)?.to_vec();
                if !bytes.is_empty() {
                    uploads.push(UploadedAttachment {
                        bytes,
                        file_name,
                        mime,
                    });
                }
            }
            _ => {}
        }
    }
    let envelope = envelope.ok_or_else(|| {
        (
            StatusCode::BAD_REQUEST,
            "multipart field 'capture' is required".to_string(),
        )
    })?;
    Ok((envelope, uploads))
}

async fn ingest_capture_inner<S, B>(
    state: &AppState<S, B>,
    tenant: &str,
    mut envelope: CaptureEnvelope,
    uploads: Vec<UploadedAttachment>,
) -> Result<CaptureIngestResponse, (StatusCode, String)>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    if envelope.body.trim().is_empty() && !uploads.is_empty() {
        envelope.body.clear();
    }
    validate_capture_with_uploads(&envelope, &uploads)?;
    let upload_hashes = uploads
        .iter()
        .map(|upload| content_hash(&upload.bytes))
        .collect::<Vec<_>>();
    let marker_id = capture_marker_id(tenant, &envelope, &uploads, &upload_hashes);
    if let Some(existing) = existing_capture(state, &marker_id, &envelope.client_id)? {
        return Ok(existing);
    }

    let mut attachments = {
        let cp = state.store.lock().map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "store lock poisoned".to_string(),
            )
        })?;
        let mut resolved = Vec::with_capacity(envelope.attachments.len() + uploads.len());
        for reference in &envelope.attachments {
            let bytes = cp
                .blobs()
                .get(&reference.blob_hash)
                .map_err(internal_store_error)?
                .ok_or_else(|| {
                    (
                        StatusCode::BAD_REQUEST,
                        format!("attachment blob not found: {}", reference.blob_hash),
                    )
                })?;
            resolved.push(ResolvedAttachment {
                reference: reference.clone(),
                bytes: if resolved.is_empty() {
                    bytes
                } else {
                    Vec::new()
                },
            });
        }
        for (upload, expected_hash) in uploads.into_iter().zip(upload_hashes) {
            let blob_hash = cp
                .blobs()
                .put(&upload.bytes)
                .map_err(internal_store_error)?;
            if blob_hash != expected_hash {
                return Err((
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "blob store returned a non-canonical content hash".to_string(),
                ));
            }
            resolved.push(ResolvedAttachment {
                reference: AttachmentRef {
                    blob_hash,
                    file_name: upload.file_name,
                    mime: upload.mime,
                },
                bytes: if resolved.is_empty() {
                    upload.bytes
                } else {
                    Vec::new()
                },
            });
        }
        resolved
    };

    let primary = attachments.first();
    let primary_mime = primary.and_then(|attachment| attachment.reference.mime.as_deref());
    let kind = capture_item_kind(&envelope, primary_mime);
    let is_audio = primary_mime.is_some_and(|mime| mime.starts_with("audio/"))
        || matches!(&kind, ItemKind::Other(name) if name == "audio");
    if is_audio {
        if let Some(primary) = primary {
            let transcriber = Transcriber::from_env();
            if transcriber.is_enabled() {
                match transcriber
                    .transcribe(&primary.bytes, primary.reference.mime.as_deref())
                    .await
                {
                    Ok(Some(transcript)) => {
                        envelope.body = merge_caption(
                            (!envelope.body.trim().is_empty()).then(|| envelope.body.clone()),
                            &transcript,
                        );
                    }
                    Ok(None) => {}
                    Err(error) => eprintln!("voice transcription failed: {error}"),
                }
            }
        }
    }

    let title = envelope
        .title
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .or_else(|| {
            attachments
                .first()
                .and_then(|attachment| attachment.reference.file_name.clone())
        })
        .unwrap_or_else(|| "Capture".to_string());
    let body = match attachments.first() {
        Some(attachment) => IngestBody::Binary {
            bytes: attachment.bytes.clone(),
            mime: attachment.reference.mime.clone(),
            kind,
            text: (!envelope.body.trim().is_empty()).then(|| envelope.body.clone()),
        },
        None => IngestBody::Text {
            text: envelope.body.clone(),
            kind,
        },
    };
    let input = IngestInput {
        title,
        body,
        source: envelope.source_url.clone(),
        source_ref: Some(SourceRef::new(
            "commonplace:capture-idempotency",
            marker_id.clone(),
        )),
        residency: Residency::Local,
        tags: envelope
            .properties
            .get("tags")
            .map(|tags| {
                tags.split(',')
                    .map(str::trim)
                    .filter(|tag| !tag.is_empty())
                    .map(str::to_string)
                    .collect()
            })
            .unwrap_or_default(),
        task: None,
        remind_at_ms: None,
        due_at_ms: None,
        provenance: None,
    };

    let mut cp = state.store.lock().map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            "store lock poisoned".to_string(),
        )
    })?;
    if let Some(marker) = cp.store().get_node(&marker_id) {
        let target_id = marker
            .properties
            .get("target_id")
            .and_then(serde_json::Value::as_str)
            .ok_or_else(|| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "capture idempotency marker has no target".to_string(),
                )
            })?;
        let item = cp
            .get_item(target_id)
            .map_err(internal_store_error)?
            .ok_or_else(|| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "capture idempotency target is missing".to_string(),
                )
            })?;
        return Ok(CaptureIngestResponse::from_item(
            item,
            false,
            envelope.client_id,
        ));
    }

    let mut item = IngestPipeline::default()
        .without_content_core()
        .ingest(&mut cp, input)
        .map_err(internal_store_error)?
        .item;
    item.extra.insert(
        "capture_client_id".to_string(),
        serde_json::json!(envelope.client_id),
    );
    item.extra.insert(
        "capture_method".to_string(),
        serde_json::json!(envelope.capture_method.as_str()),
    );
    item.extra.insert(
        "capture_source".to_string(),
        serde_json::json!(envelope.source.as_str()),
    );
    item.extra.insert(
        "capture_object_type".to_string(),
        serde_json::json!(envelope.object_type.as_str()),
    );
    item.extra.insert(
        "captured_at".to_string(),
        serde_json::json!(envelope.captured_at),
    );
    item.extra.insert(
        "capture_properties".to_string(),
        serde_json::to_value(&envelope.properties).map_err(|error| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("capture properties failed: {error}"),
            )
        })?,
    );
    let attachment_refs = attachments
        .drain(..)
        .map(|attachment| attachment.reference)
        .collect::<Vec<_>>();
    item.extra.insert(
        "capture_attachments".to_string(),
        serde_json::to_value(attachment_refs).map_err(|error| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("capture attachments failed: {error}"),
            )
        })?,
    );
    let item = cp.put_item(item).map_err(internal_store_error)?;
    cp.store_mut()
        .upsert_node(NodeRecord::new(
            marker_id,
            ["CaptureIdempotency"],
            serde_json::json!({
                "tenant": tenant,
                "target_id": item.id,
            }),
        ))
        .map_err(internal_store_error)?;

    Ok(CaptureIngestResponse::from_item(
        item,
        true,
        envelope.client_id,
    ))
}

fn validate_capture_with_uploads(
    envelope: &CaptureEnvelope,
    uploads: &[UploadedAttachment],
) -> Result<(), (StatusCode, String)> {
    if envelope.body.trim().is_empty() && envelope.attachments.is_empty() && uploads.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            "body or an attachment is required".to_string(),
        ));
    }
    if envelope.client_id.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "client_id is required".to_string()));
    }
    if envelope
        .attachments
        .len()
        .checked_add(uploads.len())
        .is_none_or(|count| count > MAX_CAPTURE_ATTACHMENTS)
    {
        return Err((
            StatusCode::PAYLOAD_TOO_LARGE,
            format!("capture supports at most {MAX_CAPTURE_ATTACHMENTS} attachments"),
        ));
    }
    for attachment in &envelope.attachments {
        let digest = attachment
            .blob_hash
            .strip_prefix("sha256:")
            .filter(|value| {
                value.len() == 64 && value.bytes().all(|byte| byte.is_ascii_hexdigit())
            });
        if digest.is_none() {
            return Err((
                StatusCode::BAD_REQUEST,
                "attachment blob_hash must be sha256:<64 hex characters>".to_string(),
            ));
        }
    }
    chrono::DateTime::parse_from_rfc3339(&envelope.captured_at).map_err(|_| {
        (
            StatusCode::BAD_REQUEST,
            "captured_at must be RFC3339".to_string(),
        )
    })?;
    Ok(())
}

/// The item kind for a blob capture: an explicit `kind` hint wins
/// (image|file|audio, or any custom kind); otherwise inferred from the mime.
fn blob_item_kind(hint: Option<&str>, mime: Option<&str>) -> ItemKind {
    if let Some(hint) = hint.map(str::trim).filter(|value| !value.is_empty()) {
        return ItemKind::from(hint.to_ascii_lowercase());
    }
    match mime {
        Some(mime) if mime.starts_with("image/") => ItemKind::Image,
        Some(mime) if mime.starts_with("audio/") => ItemKind::Other("audio".to_string()),
        _ => ItemKind::File,
    }
}

/// Multipart `POST /ingest/blob`: fields `title` (text), `kind` (optional
/// image|file|audio hint), `tags` (optional comma-separated), `text` (optional
/// caption/body), `file` (binary). Stores the bytes via the BlobStore and runs
/// the ingest pipeline, so the capture classifies/files/links like any other.
async fn ingest_blob_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
    mut multipart: Multipart,
) -> Result<Json<CaptureIngestResponse>, (StatusCode, String)>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    let principal =
        authorize(&state, &headers).map_err(|status| (status, "invalid API key".to_string()))?;

    let mut title: Option<String> = None;
    let mut kind_hint: Option<String> = None;
    let mut tags: Vec<String> = Vec::new();
    let mut caption: Option<String> = None;
    let mut file_bytes: Option<Vec<u8>> = None;
    let mut file_name: Option<String> = None;
    let mut mime: Option<String> = None;

    while let Some(field) = multipart.next_field().await.map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            format!("invalid multipart body: {error}"),
        )
    })? {
        let name = field.name().unwrap_or_default().to_string();
        match name.as_str() {
            "title" => {
                title = Some(field.text().await.map_err(bad_field)?);
            }
            "kind" => {
                kind_hint = Some(field.text().await.map_err(bad_field)?);
            }
            "tags" => {
                let raw = field.text().await.map_err(bad_field)?;
                tags = raw
                    .split(',')
                    .map(str::trim)
                    .filter(|tag| !tag.is_empty())
                    .map(str::to_string)
                    .collect();
            }
            "text" => {
                let raw = field.text().await.map_err(bad_field)?;
                if !raw.trim().is_empty() {
                    caption = Some(raw);
                }
            }
            "file" => {
                file_name = field.file_name().map(str::to_string);
                mime = field.content_type().map(str::to_string);
                file_bytes = Some(field.bytes().await.map_err(bad_field)?.to_vec());
            }
            _ => {}
        }
    }

    let bytes = file_bytes
        .filter(|bytes| !bytes.is_empty())
        .ok_or_else(|| {
            (
                StatusCode::BAD_REQUEST,
                "multipart field 'file' with content is required".to_string(),
            )
        })?;
    let title = title
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or(file_name.clone())
        .unwrap_or_else(|| "Capture".to_string());
    let mut legacy_key_bytes = Vec::new();
    legacy_key_bytes.extend_from_slice(title.as_bytes());
    legacy_key_bytes.push(0);
    legacy_key_bytes.extend_from_slice(caption.as_deref().unwrap_or_default().as_bytes());
    legacy_key_bytes.push(0);
    legacy_key_bytes.extend_from_slice(&bytes);
    if kind_hint.is_none() {
        kind_hint = match mime.as_deref() {
            Some(value) if value.starts_with("image/") => Some("image".to_string()),
            Some(value) if value.starts_with("audio/") => Some("audio".to_string()),
            _ => None,
        };
    }
    let envelope = CaptureEnvelope {
        client_id: "mobile-legacy".to_string(),
        title: Some(title),
        body: caption.unwrap_or_default(),
        object_type: ObjectType::File,
        capture_method: CaptureMethod::Composed,
        source: CaptureSource::Mobile,
        captured_at: chrono::Utc::now().to_rfc3339(),
        source_url: None,
        kind_hint,
        properties: BTreeMap::from([("tags".to_string(), tags.join(","))]),
        attachments: Vec::new(),
        idempotency_key: Some(content_hash(&legacy_key_bytes)),
    };
    let upload = UploadedAttachment {
        bytes,
        file_name,
        mime,
    };
    ingest_capture_inner(&state, &principal.id, envelope, vec![upload])
        .await
        .map(Json)
}

fn bad_field(error: axum::extract::multipart::MultipartError) -> (StatusCode, String) {
    (
        StatusCode::BAD_REQUEST,
        format!("invalid multipart field: {error}"),
    )
}

/// Fold a fresh transcript into any caption the user already typed.
fn merge_caption(existing: Option<String>, transcript: &str) -> String {
    match existing {
        Some(text) if !text.trim().is_empty() => format!("{text}\n\n{transcript}"),
        _ => transcript.to_string(),
    }
}

/// Read-back request: the answer text and an optional per-call voice override.
#[derive(Deserialize)]
struct TtsRequest {
    text: String,
    #[serde(default)]
    voice: Option<String>,
}

/// `POST /tts`: synthesize speech from text through the env-configured provider
/// (ElevenLabs by default, or a self-hosted Kokoro node). The provider key stays
/// on the server; the client only ever sees audio bytes.
async fn tts_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
    Json(request): Json<TtsRequest>,
) -> Result<Response, (StatusCode, String)>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    authorize(&state, &headers).map_err(|status| (status, "invalid API key".to_string()))?;

    let trimmed = request.text.trim();
    if trimmed.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "text is required".to_string()));
    }
    // Cap read-back length so a runaway answer cannot fan out a large TTS bill.
    let text: String = trimmed.chars().take(5000).collect();

    let voice = Voice::from_env().map_err(|error| (StatusCode::SERVICE_UNAVAILABLE, error))?;
    let speech = voice
        .synthesize(&text, request.voice.as_deref())
        .await
        .map_err(|error| (StatusCode::BAD_GATEWAY, error))?;

    Ok(([(header::CONTENT_TYPE, speech.mime)], speech.bytes).into_response())
}

/// `GET /blob/{hash}`: the raw bytes at a content hash, served with the mime
/// recorded on the item that references the blob (fallback octet-stream).
async fn blob_get_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
    AxumPath(hash): AxumPath<String>,
) -> Result<Response, StatusCode>
where
    S: EmbeddingGraphStore + GraphSnapshotSource + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    authorize(&state, &headers)?;

    let cp = state
        .store
        .lock()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let bytes = cp
        .blobs()
        .get(&hash)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    let mime = cp
        .all_items()
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .into_iter()
        .find_map(|item| {
            if let ItemBody::Blob {
                content_hash, mime, ..
            } = &item.body
            {
                if content_hash == &hash {
                    return mime.clone();
                }
            }
            item.extra
                .get("capture_attachments")
                .and_then(serde_json::Value::as_array)
                .and_then(|attachments| {
                    attachments.iter().find_map(|attachment| {
                        (attachment
                            .get("blob_hash")
                            .and_then(serde_json::Value::as_str)
                            == Some(hash.as_str()))
                        .then(|| {
                            attachment
                                .get("mime")
                                .and_then(serde_json::Value::as_str)
                                .map(str::to_string)
                        })
                        .flatten()
                    })
                })
        })
        .unwrap_or_else(|| "application/octet-stream".to_string());
    drop(cp);

    Ok(([(header::CONTENT_TYPE, mime)], bytes).into_response())
}

pub async fn run_from_env() -> Result<(), String> {
    let api_key = std::env::var("COMMONPLACE_API_KEY").unwrap_or_else(|_| "dev-key".to_string());
    let instance =
        std::env::var("COMMONPLACE_INSTANCE_ID").unwrap_or_else(|_| "default".to_string());
    let registry = Arc::new(ApiKeyRegistry::new().with_key(api_key, instance));
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(50090);
    let model = answer_model_from_env();

    let app = match std::env::var("COMMONPLACE_DATA_DIR") {
        Ok(dir) if !dir.trim().is_empty() => {
            let store = redcore_store(&dir).map_err(|error| {
                format!("commonplace-api open durable store at {dir}: {error:?}")
            })?;
            build_router_with_model(store, registry, Arc::clone(&model))
        }
        _ => build_router_with_model(in_memory_store(), registry, model),
    };

    let listener = tokio::net::TcpListener::bind(("::", port))
        .await
        .map_err(|error| format!("commonplace-api bind [::]:{port}: {error}"))?;
    println!("commonplace-api listening on [::]:{port}");
    axum::serve(listener, app)
        .await
        .map_err(|error| format!("commonplace-api serve: {error}"))
}

async fn prepare_loopback_server(
    addr: SocketAddr,
    data_dir: impl AsRef<Path>,
    api_key: impl Into<String>,
    instance: impl Into<String>,
) -> Result<(Router, tokio::net::TcpListener), String> {
    let data_dir = data_dir.as_ref();
    let store = redcore_store(data_dir).map_err(|error| {
        format!(
            "commonplace-api open durable store at {}: {error:?}",
            data_dir.display()
        )
    })?;
    let registry = Arc::new(ApiKeyRegistry::new().with_key(api_key.into(), instance.into()));
    let app = build_loopback_router_from_schema(
        build_schema_with_model(
            Arc::clone(&store),
            Arc::clone(&registry),
            answer_model_from_env(),
        ),
        registry,
        store,
    );
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|error| format!("commonplace-api bind {addr}: {error}"))?;
    Ok((app, listener))
}

pub async fn serve_loopback(
    addr: SocketAddr,
    data_dir: impl AsRef<Path>,
    api_key: impl Into<String>,
    instance: impl Into<String>,
    shutdown: impl Future<Output = ()> + Send + 'static,
) -> Result<(), String> {
    let (app, listener) = prepare_loopback_server(addr, data_dir, api_key, instance).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await
        .map_err(|error| format!("commonplace-api serve: {error}"))
}

pub async fn serve_loopback_with_ready(
    addr: SocketAddr,
    data_dir: impl AsRef<Path>,
    api_key: impl Into<String>,
    instance: impl Into<String>,
    ready: SyncSender<Result<(), String>>,
    shutdown: impl Future<Output = ()> + Send + 'static,
) -> Result<(), String> {
    match prepare_loopback_server(addr, data_dir, api_key, instance).await {
        Ok((app, listener)) => {
            let _ = ready.send(Ok(()));
            axum::serve(listener, app)
                .with_graceful_shutdown(shutdown)
                .await
                .map_err(|error| format!("commonplace-api serve: {error}"))
        }
        Err(error) => {
            let _ = ready.send(Err(error.clone()));
            Err(error)
        }
    }
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, SystemTime, UNIX_EPOCH};

    use axum::http::{header, StatusCode};
    use reqwest::Method;
    use tokio::sync::oneshot;

    use super::prepare_loopback_server;

    #[tokio::test]
    async fn loopback_router_does_not_allow_cross_origin_graphql_preflight() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let data_dir = std::env::current_dir()
            .expect("cwd")
            .join("target")
            .join(format!("loopback-cors-{unique}"));
        std::fs::create_dir_all(&data_dir).expect("create data dir");

        let (app, listener) = prepare_loopback_server(
            ([127, 0, 0, 1], 0).into(),
            &data_dir,
            "loopback-test-key",
            "default",
        )
        .await
        .expect("prepare loopback server");
        let port = listener.local_addr().expect("listener addr").port();
        let (shutdown_tx, shutdown_rx) = oneshot::channel();
        let server = tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    let _ = shutdown_rx.await;
                })
                .await
                .expect("serve loopback test server");
        });

        tokio::time::sleep(Duration::from_millis(50)).await;
        let client = reqwest::Client::new();
        let response = client
            .request(Method::OPTIONS, format!("http://127.0.0.1:{port}/graphql"))
            .header(header::ORIGIN, "https://evil.example")
            .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
            .header(
                header::ACCESS_CONTROL_REQUEST_HEADERS,
                "x-api-key,content-type",
            )
            .send()
            .await
            .expect("send preflight");
        assert!(
            response
                .headers()
                .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                .is_none(),
            "loopback GraphQL must not opt into cross-origin browser access"
        );

        let get = client
            .get(format!("http://127.0.0.1:{port}/graphql"))
            .send()
            .await
            .expect("send graphiql probe");
        assert_eq!(get.status(), StatusCode::METHOD_NOT_ALLOWED);

        let _ = shutdown_tx.send(());
        let _ = server.await;
        let _ = std::fs::remove_dir_all(&data_dir);
    }
}
