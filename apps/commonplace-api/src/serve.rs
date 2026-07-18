//! Shared HTTP serving surface for the CommonPlace API.
//!
//! The standalone binary and the desktop embedder both serve the same GraphQL
//! contract. The binary uses environment-driven configuration; the desktop uses
//! [`serve_loopback`] with a durable local data directory and graceful shutdown.
//!
//! Alongside `/graphql`, both routers expose the PT-017 blob capture seam:
//! multipart `POST /ingest/blob` (BlobStore + ingest pipeline) and
//! `GET /blob/{hash}` (raw bytes with the item's mime), gated by the same
//! `x-api-key` registry.

use std::future::Future;
use std::net::SocketAddr;
use std::path::Path;
use std::sync::{mpsc::SyncSender, Arc};

use async_graphql::http::GraphiQLSource;
use async_graphql::{EmptySubscription, Request, Schema};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::extract::{DefaultBodyLimit, Multipart, Path as AxumPath, State};
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{Html, IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use commonplace::{
    BlobStore, EmbeddingGraphStore, IngestBody, IngestInput, IngestPipeline, Item, ItemBody,
    ItemKind, ObjectAction, ObjectActionReceipt, ObjectQuery, ObjectSet, Residency, ViewDescriptor,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;

use crate::voice::{Transcriber, Voice};
use crate::{
    answer_model_from_env, build_schema, build_schema_with_model, in_memory_store, redcore_store,
    AnswerModel, ApiKeyRegistry, ApiKeyToken, Mutation, Query, SharedStore,
};

/// PT-017: cap multipart capture bodies (photo/file/voice) at 32MB.
const BLOB_BODY_LIMIT_BYTES: usize = 32 * 1024 * 1024;

struct AppState<S, B>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    schema: Schema<Query<S, B>, Mutation<S, B>, EmptySubscription>,
    registry: Arc<ApiKeyRegistry>,
    store: SharedStore<S, B>,
}

impl<S, B> Clone for AppState<S, B>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    Router::new()
        .route(
            "/ingest/blob",
            post(ingest_blob_handler::<S, B>).layer(DefaultBodyLimit::max(BLOB_BODY_LIMIT_BYTES)),
        )
        .route("/blob/{hash}", get(blob_get_handler::<S, B>))
        .route("/capabilities", get(capabilities_handler::<S, B>))
        .route("/tts", post(tts_handler::<S, B>))
}

#[derive(Serialize)]
struct NativeCapabilities {
    voice_capture: bool,
    voice_readback: bool,
    chat_attachments: bool,
}

/// Safe capability discovery for native clients. Provider names and secrets
/// stay server-side; the client only learns whether an affordance is real.
async fn capabilities_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
) -> Result<Json<NativeCapabilities>, StatusCode>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    authorize(&state, &headers)?;
    Ok(Json(NativeCapabilities {
        voice_capture: Transcriber::from_env().is_enabled(),
        voice_readback: Voice::from_env().is_ok(),
        // This must only be enabled when the configured hosted ACP route
        // consumes file and image content parts instead of dropping them.
        chat_attachments: std::env::var("COMMONPLACE_CHAT_ATTACHMENTS")
            .is_ok_and(|value| value == "1" || value.eq_ignore_ascii_case("true")),
    }))
}

/// The block-view object-model seam over HTTP (SPEC-OBJECT-CONTRACT-V2). The web
/// `HttpBlockHost` reaches the same `query_object_set` / `emit_object_action` /
/// registry the Rust `CommonplaceBlockHost` uses, so a surface renders live from
/// the substrate with nothing above the `BlockHost` seam changing.
fn object_routes<S, B>() -> Router<AppState<S, B>>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
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

/// The same `x-api-key` gate `/graphql` applies, reused by the blob routes.
fn authorize<S, B>(state: &AppState<S, B>, headers: &HeaderMap) -> Result<(), StatusCode>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    headers
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
        .filter(|key| state.registry.resolve(key).is_some())
        .map(|_| ())
        .ok_or(StatusCode::FORBIDDEN)
}

async fn graphql_handler<S, B>(
    State(state): State<AppState<S, B>>,
    headers: HeaderMap,
    req: GraphQLRequest,
) -> Result<GraphQLResponse, StatusCode>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
    let key = headers
        .get("x-api-key")
        .and_then(|value| value.to_str().ok())
        .filter(|key| state.registry.resolve(key).is_some())
        .ok_or(StatusCode::FORBIDDEN)?;

    let request: Request = req.into_inner().data(ApiKeyToken(key.to_string()));
    Ok(state.schema.execute(request).await.into())
}

/// PT-017 response: the ItemGql shape a client needs to render a capture
/// receipt, serialized camelCase like the GraphQL surface.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BlobIngestResponse {
    id: String,
    kind: String,
    title: String,
    classification: Option<String>,
    collections: Vec<String>,
    tags: Vec<String>,
    remind_at_ms: Option<i64>,
    created_at_ms: i64,
    blob_hash: Option<String>,
    mime: Option<String>,
}

impl From<Item> for BlobIngestResponse {
    fn from(item: Item) -> Self {
        let (blob_hash, mime) = match &item.body {
            ItemBody::Blob {
                content_hash, mime, ..
            } => (Some(content_hash.clone()), mime.clone()),
            _ => (None, None),
        };
        Self {
            id: item.id,
            kind: item.kind.as_str().to_string(),
            title: item.title,
            classification: item.classification,
            collections: item.collections,
            tags: item.tags,
            remind_at_ms: item.remind_at_ms,
            created_at_ms: item.created_at_ms,
            blob_hash,
            mime,
        }
    }
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
) -> Result<Json<BlobIngestResponse>, (StatusCode, String)>
where
    S: EmbeddingGraphStore + Send + Sync + 'static,
    B: BlobStore + Send + Sync + 'static,
{
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
        .or(file_name)
        .unwrap_or_else(|| "Capture".to_string());
    let kind = blob_item_kind(kind_hint.as_deref(), mime.as_deref());

    // Voice captures: transcribe server-side when a provider is configured, then
    // fold the transcript into the body so it embeds/searches like any capture.
    // Fail-open: a transcription error keeps the audio blob, just untranscribed.
    let is_audio = mime
        .as_deref()
        .is_some_and(|mime| mime.starts_with("audio/"))
        || matches!(&kind, ItemKind::Other(name) if name.as_str() == "audio");
    let transcriber = Transcriber::from_env();
    let caption = if is_audio && transcriber.is_enabled() {
        match transcriber.transcribe(&bytes, mime.as_deref()).await {
            Ok(Some(transcript)) => Some(merge_caption(caption, &transcript)),
            Ok(None) => caption,
            Err(error) => {
                eprintln!("voice transcription failed: {error}");
                caption
            }
        }
    } else {
        caption
    };

    let input = IngestInput {
        title,
        body: IngestBody::Binary {
            bytes,
            mime,
            kind,
            text: caption,
        },
        source: None,
        source_ref: None,
        residency: Residency::Local,
        tags,
        task: None,
        remind_at_ms: None,
        due_at_ms: None,
    };

    // Blob captures keep the blob body: content-core extraction (which
    // rewrites supported binaries into text bodies) stays off this route so
    // blob_hash and mime always land on the item.
    let item = {
        let mut cp = state.store.lock().map_err(|_| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                "store lock poisoned".to_string(),
            )
        })?;
        IngestPipeline::default()
            .without_content_core()
            .ingest(&mut cp, input)
            .map_err(|error| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("ingest failed: {error:?}"),
                )
            })?
            .item
    };

    Ok(Json(BlobIngestResponse::from(item)))
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
    S: EmbeddingGraphStore + Send + Sync + 'static,
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
        .find_map(|item| match item.body {
            ItemBody::Blob {
                content_hash, mime, ..
            } if content_hash == hash => mime,
            _ => None,
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
