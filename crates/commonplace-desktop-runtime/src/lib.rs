use std::{
    collections::{BTreeMap, HashMap},
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    thread::JoinHandle,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::webview::WebviewWindowBuilder;
use tauri::{path::BaseDirectory, Emitter, Manager, WebviewUrl};
use tokio::sync::oneshot;

const HOSTED_ENDPOINT: &str = "https://rustyredcore-theorem-production.up.railway.app/mcp";
const LOCAL_NODE_PORT: u16 = 17888;
const COMMONPLACE_NODE_PORT: u16 = 17890;
const KEYCHAIN_SERVICE: &str = "me.travisgilbert.commonplace";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HarnessSettings {
    endpoint: String,
    local_endpoint: String,
    active_target: String,
    tenant: String,
    bearer_present: bool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReceiverSettings {
    enabled: bool,
    claim_interval_secs: u64,
    worktrees: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Rect {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

impl Default for Rect {
    fn default() -> Self {
        Self {
            x: 0,
            y: 0,
            width: 900,
            height: 700,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalNodeStatus {
    node_up: bool,
    endpoint: String,
    port: u16,
    store_path: String,
    active_target: String,
    tools_match_hosted: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CommonplaceStatus {
    node_up: bool,
    endpoint: String,
    port: u16,
    store_path: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HostedConnectionStatus {
    endpoint: String,
    tenant: String,
    bearer_present: bool,
    reachable: bool,
    document_count: Option<u64>,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelStatus {
    enabled: bool,
    endpoint: String,
    model: String,
    reachable: bool,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReceiverStatus {
    enabled: bool,
    state: String,
    lanes: Vec<String>,
    last_claim_time: Option<String>,
    last_job_result: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecallHit {
    id: String,
    title: String,
    snippet: String,
    tags: Vec<String>,
    url: Option<String>,
    created_at: Option<u64>,
}

#[derive(Clone, Debug, Deserialize)]
struct RememberInput {
    text: String,
    url: Option<String>,
    title: Option<String>,
    tags: Option<Vec<String>>,
    provenance: Option<Value>,
}

#[derive(Clone, Debug, Deserialize)]
struct RecallQuery {
    text: Option<String>,
    domain: Option<String>,
    limit: Option<u64>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelChatInput {
    model: String,
    messages: Vec<ModelMessage>,
    ollama_endpoint: Option<String>,
    ollama_model: Option<String>,
    local_endpoint: Option<String>,
    local_model: Option<String>,
    local_protocol: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct ModelMessage {
    role: String,
    content: String,
}

#[derive(Clone, Debug, Serialize)]
struct ModelChatResult {
    content: String,
    usage: TurnUsage,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct TurnUsage {
    provider: String,
    model: String,
    tokens_in: u64,
    tokens_out: u64,
    estimated_usd: f64,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SyncReceipt {
    id: String,
    status: String,
    started_at: String,
    finished_at: Option<String>,
    local_pack: Option<String>,
    hosted_pack: Option<String>,
    merged_nodes: Option<u64>,
    merged_edges: Option<u64>,
    conflicts: Option<u64>,
    message: String,
}

#[derive(Clone, Debug, Deserialize)]
struct BackgroundFetchInput {
    urls: Vec<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SpaceBindInput {
    room_id: String,
    space_name: String,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoomPostInput {
    room_id: String,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
struct RoomContext {
    feed: Vec<RoomFeedItem>,
    participants: Vec<RoomParticipant>,
    intents: Vec<RoomIntentItem>,
    records: Vec<RoomRecordItem>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomFeedItem {
    id: String,
    actor: String,
    text: String,
    created_at: Option<String>,
    kind: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomParticipant {
    actor: String,
    status: String,
    last_seen: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomIntentItem {
    actor: String,
    status: String,
    summary: String,
    footprint: Vec<String>,
    updated_at: Option<String>,
    expected_completion: Option<String>,
    repo: Option<String>,
    branch: Option<String>,
    task: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomRecordItem {
    id: String,
    kind: String,
    actor: Option<String>,
    title: Option<String>,
    summary: String,
    body: Option<String>,
    refs: Vec<String>,
    created_at: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JobSubmitInput {
    title: String,
    spec_ref: String,
    repo: String,
    kind: String,
    priority: Option<String>,
    target_head: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
struct QueueStatusInput {
    repo: Option<String>,
    status: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct QueueJob {
    job_id: String,
    title: String,
    status: String,
    target_head: Option<String>,
    priority: Option<String>,
    age: Option<String>,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentTabIngestInput {
    tab_id: String,
    url: String,
    title: Option<String>,
    text: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentIngestionReceipt {
    id: String,
    status: String,
    url: String,
    title: Option<String>,
    captured_at: String,
    store_target: String,
    trust_tier: String,
    message: String,
    /// Store-assigned id of the written note, when the remember payload names one.
    object_id: Option<String>,
    /// Title of the nearest existing memory (best-effort recall by title), for
    /// the Keep confirmation toast (HANDOFF-COBROWSE-PRESENCE D8).
    nearest_neighbor: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectorProofResult {
    status: String,
    affordance_id: String,
    message: String,
}

#[derive(Clone, Debug)]
struct TabRuntime {
    label: String,
    url: String,
    title: String,
}

struct LocalNodeRuntime {
    endpoint: String,
    store_path: String,
    shutdown: Option<oneshot::Sender<()>>,
}

struct CommonplaceRuntime {
    endpoint: String,
    store_path: String,
    shutdown: Option<oneshot::Sender<()>>,
}

#[derive(Default)]
struct ReceiverThreadStatus {
    state: String,
    last_claim_time: Option<String>,
    last_job_result: Option<String>,
    error: Option<String>,
}

struct ReceiverRuntime {
    stop: Arc<AtomicBool>,
    handle: Option<JoinHandle<()>>,
    status: Arc<Mutex<ReceiverThreadStatus>>,
}

struct DesktopBackendState {
    harness: HarnessSettings,
    receiver: ReceiverSettings,
    local_node: Option<LocalNodeRuntime>,
    commonplace_node: Option<CommonplaceRuntime>,
    receiver_runtime: Option<ReceiverRuntime>,
    tabs: HashMap<String, TabRuntime>,
    active_tab: Option<String>,
    bounds: Rect,
}

impl Default for DesktopBackendState {
    fn default() -> Self {
        let mut worktrees = BTreeMap::new();
        worktrees.insert(
            "Travis-Gilbert/CommonPlace".to_string(),
            "/Users/travisgilbert/Tech Dev Local/Creative/Website/CommonPlace".to_string(),
        );
        worktrees.insert(
            "Travis-Gilbert/theorem".to_string(),
            "/Users/travisgilbert/Tech Dev Local/Creative/Website/Theorem".to_string(),
        );

        Self {
            harness: HarnessSettings {
                endpoint: HOSTED_ENDPOINT.to_string(),
                local_endpoint: format!("http://127.0.0.1:{LOCAL_NODE_PORT}/mcp"),
                active_target: "local".to_string(),
                tenant: "Travis-Gilbert".to_string(),
                bearer_present: secret_get("harness_bearer").is_ok(),
            },
            receiver: ReceiverSettings {
                enabled: false,
                claim_interval_secs: 20,
                worktrees,
            },
            local_node: None,
            commonplace_node: None,
            receiver_runtime: None,
            tabs: HashMap::new(),
            active_tab: None,
            bounds: Rect::default(),
        }
    }
}

#[tauri::command]
fn harness_settings_get(
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<HarnessSettings, String> {
    let mut settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    settings.bearer_present = secret_get("harness_bearer").is_ok();
    Ok(settings)
}

#[tauri::command]
fn harness_settings_set(
    settings: HarnessSettings,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    state.lock().map_err(|error| error.to_string())?.harness = settings;
    Ok(())
}

#[tauri::command]
fn harness_bearer_set(
    token: String,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    secret_set("harness_bearer", &token)?;
    state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .bearer_present = true;
    Ok(())
}

#[tauri::command]
fn harness_bearer_clear(state: tauri::State<'_, Mutex<DesktopBackendState>>) -> Result<(), String> {
    let _ = secret_delete("harness_bearer");
    state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .bearer_present = false;
    Ok(())
}

#[tauri::command]
fn local_node_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<LocalNodeStatus, String> {
    let backend = state.lock().map_err(|error| error.to_string())?;
    let harness = backend.harness.clone();
    let store_path = app_store_path(&app)?;
    let node_up = backend.local_node.is_some();
    let endpoint = backend
        .local_node
        .as_ref()
        .map(|node| node.endpoint.clone())
        .unwrap_or(harness.local_endpoint);
    let store_path = backend
        .local_node
        .as_ref()
        .map(|node| node.store_path.clone())
        .unwrap_or_else(|| store_path.display().to_string());

    Ok(LocalNodeStatus {
        node_up,
        endpoint,
        port: LOCAL_NODE_PORT,
        store_path,
        active_target: harness.active_target,
        tools_match_hosted: node_up && tools_match_hosted(&backend.harness).unwrap_or(false),
    })
}

#[tauri::command]
fn receiver_settings_get(
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<ReceiverSettings, String> {
    Ok(state
        .lock()
        .map_err(|error| error.to_string())?
        .receiver
        .clone())
}

#[tauri::command]
fn receiver_settings_set(
    settings: ReceiverSettings,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    let mut backend = state.lock().map_err(|error| error.to_string())?;
    let should_run = settings.enabled;
    backend.receiver = settings;
    if should_run {
        start_receiver_locked(&mut backend)?;
    } else {
        stop_receiver_locked(&mut backend);
    }
    Ok(())
}

#[tauri::command]
fn receiver_status(
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<ReceiverStatus, String> {
    let backend = state.lock().map_err(|error| error.to_string())?;
    let lanes = theorem_receiver::detect_lanes();
    let mut status = if backend.receiver.enabled {
        if backend.receiver_runtime.is_some() {
            "running".to_string()
        } else if lanes.is_empty() {
            "error".to_string()
        } else {
            "configured".to_string()
        }
    } else {
        "off".to_string()
    };
    let mut last_claim_time = None;
    let mut last_job_result = None;
    if let Some(runtime) = &backend.receiver_runtime {
        if let Ok(shared) = runtime.status.lock() {
            if let Some(error) = &shared.error {
                status = format!("error: {error}");
            } else if !shared.state.is_empty() {
                status = shared.state.clone();
            }
            last_claim_time = shared.last_claim_time.clone();
            last_job_result = shared.last_job_result.clone();
        }
    }
    Ok(ReceiverStatus {
        enabled: backend.receiver.enabled,
        state: status,
        lanes,
        last_claim_time,
        last_job_result,
    })
}

#[tauri::command]
fn tab_create(
    app: tauri::AppHandle,
    tab_id: String,
    url: Option<String>,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    let url = url.unwrap_or_else(|| "about:blank".to_string());
    ensure_tab_window(&app, &state, &tab_id, &url)
}

#[tauri::command]
fn tab_navigate(
    app: tauri::AppHandle,
    tab_id: String,
    url: String,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    ensure_tab_window(&app, &state, &tab_id, &url)?;
    let label = tab_label(&tab_id);
    if let Some(window) = app.get_webview_window(&label) {
        if let Ok(parsed) = tauri::Url::parse(&url) {
            let _ = window.navigate(parsed);
        }
    }
    if let Ok(mut backend) = state.lock() {
        if let Some(tab) = backend.tabs.get_mut(&tab_id) {
            tab.url = url.clone();
            tab.title = url;
        }
    }
    Ok(())
}

#[tauri::command]
fn tab_reload(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&tab_label(&tab_id)) {
        window
            .eval("window.location.reload()")
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn tab_go_back(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&tab_label(&tab_id)) {
        window
            .eval("history.back()")
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn tab_go_forward(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&tab_label(&tab_id)) {
        window
            .eval("history.forward()")
            .map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn tab_close(
    app: tauri::AppHandle,
    tab_id: String,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&tab_label(&tab_id)) {
        let _ = window.close();
    }
    let mut backend = state.lock().map_err(|error| error.to_string())?;
    backend.tabs.remove(&tab_id);
    if backend.active_tab.as_deref() == Some(&tab_id) {
        backend.active_tab = None;
    }
    Ok(())
}

#[tauri::command]
fn tab_set_active(
    app: tauri::AppHandle,
    tab_id: Option<String>,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    let labels = {
        let mut backend = state.lock().map_err(|error| error.to_string())?;
        backend.active_tab = tab_id.clone();
        backend
            .tabs
            .iter()
            .map(|(id, tab)| (id.clone(), tab.label.clone()))
            .collect::<Vec<_>>()
    };
    for (id, label) in labels {
        if let Some(window) = app.get_webview_window(&label) {
            if Some(&id) == tab_id.as_ref() {
                let _ = window.show();
                let _ = window.set_focus();
            } else {
                let _ = window.hide();
            }
        }
    }
    Ok(())
}

#[tauri::command]
fn tab_set_bounds(
    rect: Rect,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    state.lock().map_err(|error| error.to_string())?.bounds = rect;
    Ok(())
}

/// Draw the co-browse telegraph highlight inside a tab's page
/// (HANDOFF-COBROWSE-PRESENCE D3). Evals a pointer-events-none outline overlay
/// at the element bbox the agent is about to act on, gold register per the
/// accent grammar. Contract doc: apps/desktop/src/lib/commands.ts.
#[tauri::command]
fn tab_highlight(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
    tab_id: String,
    x: i32,
    y: i32,
    width: i32,
    height: i32,
    label: Option<String>,
) -> Result<(), String> {
    let tab_label = {
        let backend = state.lock().map_err(|error| error.to_string())?;
        backend
            .tabs
            .get(&tab_id)
            .map(|tab| tab.label.clone())
            .ok_or_else(|| format!("unknown tab {tab_id}"))?
    };
    let window = app
        .get_webview_window(&tab_label)
        .ok_or_else(|| format!("tab window {tab_label} missing"))?;
    let label_json =
        serde_json::to_string(&label.unwrap_or_default()).map_err(|error| error.to_string())?;
    let tag_y = (y - 24).max(0);
    let script = format!(
        r#"(function() {{
  var id = '__cp_telegraph';
  var box = document.getElementById(id);
  if (!box) {{
    box = document.createElement('div');
    box.id = id;
    box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #C49A4A;border-radius:4px;box-shadow:0 0 0 4px rgba(196,154,74,0.25);transition:left 120ms ease,top 120ms ease,width 120ms ease,height 120ms ease;';
    document.documentElement.appendChild(box);
    var tag = document.createElement('div');
    tag.id = id + '-label';
    tag.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;font:12px ui-monospace,monospace;background:#C49A4A;color:#221A10;padding:2px 6px;border-radius:3px;max-width:60vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    document.documentElement.appendChild(tag);
  }}
  box.style.left = '{x}px';
  box.style.top = '{y}px';
  box.style.width = '{width}px';
  box.style.height = '{height}px';
  box.style.display = 'block';
  var tag = document.getElementById(id + '-label');
  var text = {label_json};
  if (tag) {{
    tag.textContent = text;
    tag.style.display = text ? 'block' : 'none';
    tag.style.left = '{x}px';
    tag.style.top = '{tag_y}px';
  }}
}})();"#
    );
    window.eval(&script).map_err(|error| error.to_string())
}

/// Remove the telegraph highlight overlay from a tab's page.
#[tauri::command]
fn tab_clear_highlight(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
    tab_id: String,
) -> Result<(), String> {
    let tab_label = {
        let backend = state.lock().map_err(|error| error.to_string())?;
        backend
            .tabs
            .get(&tab_id)
            .map(|tab| tab.label.clone())
            .ok_or_else(|| format!("unknown tab {tab_id}"))?
    };
    let window = app
        .get_webview_window(&tab_label)
        .ok_or_else(|| format!("tab window {tab_label} missing"))?;
    window
        .eval(
            "(function(){var box=document.getElementById('__cp_telegraph');if(box)box.style.display='none';var tag=document.getElementById('__cp_telegraph-label');if(tag)tag.style.display='none';})();",
        )
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn extract_visible_text(
    tab_id: String,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<Value, String> {
    let tab = state
        .lock()
        .map_err(|error| error.to_string())?
        .tabs
        .get(&tab_id)
        .cloned();
    let Some(tab) = tab else {
        return Ok(json!({ "url": "", "title": "", "text": "" }));
    };
    let text = if tab.url.starts_with("http://") || tab.url.starts_with("https://") {
        fetch_text(&tab.url).unwrap_or_default()
    } else {
        String::new()
    };
    Ok(json!({
        "url": tab.url,
        "title": tab.title,
        "text": text
    }))
}

#[tauri::command]
fn session_load(app: tauri::AppHandle) -> Result<Option<Value>, String> {
    let db = open_db(&app)?;
    let mut statement = db
        .prepare("select value from kv where key = 'session'")
        .map_err(|error| error.to_string())?;
    let result: rusqlite::Result<String> = statement.query_row([], |row| row.get(0));
    match result {
        Ok(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|error| error.to_string()),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn session_save(app: tauri::AppHandle, state: Value) -> Result<(), String> {
    let db = open_db(&app)?;
    let raw = serde_json::to_string(&state).map_err(|error| error.to_string())?;
    db.execute(
        "insert into kv(key, value) values('session', ?1)
         on conflict(key) do update set value = excluded.value",
        params![raw],
    )
    .map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
fn keychain_set(provider: String, key: String) -> Result<(), String> {
    secret_set(&format!("provider:{provider}"), &key)
}

#[tauri::command]
fn keychain_has(provider: String) -> Result<bool, String> {
    Ok(secret_get(&format!("provider:{provider}")).is_ok())
}

#[tauri::command]
fn keychain_delete(provider: String) -> Result<(), String> {
    let _ = secret_delete(&format!("provider:{provider}"));
    Ok(())
}

#[tauri::command]
fn harness_remember(
    input: RememberInput,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<Value, String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    let mut tags = input.tags.clone().unwrap_or_default();
    if let Some(url) = &input.url {
        tags.push(domain_tag(url));
    }
    let payload = call_selected_tool(
        &settings,
        "remember",
        json!({
            "kind": "desktop_rail_turn",
            "title": input.title.unwrap_or_else(|| "Desktop rail turn".to_string()),
            "content": input.text,
            "tags": tags,
            "links": input.url.iter().cloned().collect::<Vec<_>>(),
            "actor": "desktop",
            "surface": "desktop",
            "project_slug": "commonplace-desktop",
            "metadata": input.provenance.unwrap_or_else(|| json!({})),
        }),
    )?;
    let id = payload
        .pointer("/document/doc_id")
        .or_else(|| payload.pointer("/document/id"))
        .or_else(|| payload.pointer("/node/node_id"))
        .and_then(Value::as_str)
        .unwrap_or("memory")
        .to_string();
    Ok(json!({ "id": id, "tags": tags }))
}

#[tauri::command]
fn harness_recall(
    query: RecallQuery,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<Vec<RecallHit>, String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    let search = query.text.or(query.domain).unwrap_or_default();
    if search.trim().is_empty() {
        return Ok(Vec::new());
    }
    let payload = call_selected_tool(
        &settings,
        "recall",
        json!({
            "query": search,
            "surface": "desktop",
            "actor": "desktop",
            "limit": query.limit.unwrap_or(6),
            "include_low_fitness": true,
        }),
    )?;
    Ok(recall_hits(&payload))
}

#[tauri::command]
fn model_chat(
    input: ModelChatInput,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<ModelChatResult, String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    let prompt = input
        .messages
        .iter()
        .map(|message| format!("{}: {}", message.role, message.content))
        .collect::<Vec<_>>()
        .join("\n");
    let tokens_in = estimate_tokens(&prompt);
    let model_id = input.model.trim().to_ascii_lowercase();
    if model_id == "ollama" {
        let content = call_ollama(&input)?;
        let tokens_out = estimate_tokens(&content);
        return Ok(ModelChatResult {
            content,
            usage: TurnUsage {
                provider: "ollama".to_string(),
                model: local_model_name(&input, "llama3.2"),
                tokens_in,
                tokens_out,
                estimated_usd: 0.0,
            },
        });
    }
    if model_id == "local" {
        let content = call_local_chat(&input)?;
        let tokens_out = estimate_tokens(&content);
        return Ok(ModelChatResult {
            content,
            usage: TurnUsage {
                provider: "local".to_string(),
                model: local_model_name(&input, "gemma3:latest"),
                tokens_in,
                tokens_out,
                estimated_usd: 0.0,
            },
        });
    }

    if let Some(profile) = provider_chat_profile(&model_id) {
        match call_provider_chat(profile, &input) {
            Ok((content, model_name)) => {
                let tokens_out = estimate_tokens(&content);
                let estimated_usd = estimate_cost_usd(&input.model, tokens_in, tokens_out);
                return Ok(ModelChatResult {
                    content,
                    usage: TurnUsage {
                        provider: input.model.clone(),
                        model: model_name,
                        tokens_in,
                        tokens_out,
                        estimated_usd,
                    },
                });
            }
            Err(provider_error) => match call_composed_agent_chat(&settings, &prompt) {
                Ok(answer) => {
                    let tokens_out = estimate_tokens(&answer);
                    let estimated_usd = estimate_cost_usd(&input.model, tokens_in, tokens_out);
                    return Ok(ModelChatResult {
                        content: answer,
                        usage: TurnUsage {
                            provider: input.model.clone(),
                            model: input.model,
                            tokens_in,
                            tokens_out,
                            estimated_usd,
                        },
                    });
                }
                Err(fallback_error) => {
                    return Err(format!(
                        "{provider_error}; composed-agent fallback failed: {fallback_error}"
                    ));
                }
            },
        }
    }

    let answer = call_composed_agent_chat(&settings, &prompt)?;
    let tokens_out = estimate_tokens(&answer);
    let estimated_usd = estimate_cost_usd(&input.model, tokens_in, tokens_out);
    Ok(ModelChatResult {
        content: answer,
        usage: TurnUsage {
            provider: input.model.clone(),
            model: input.model,
            tokens_in,
            tokens_out,
            estimated_usd,
        },
    })
}

#[tauri::command]
fn sync_run(state: tauri::State<'_, Mutex<DesktopBackendState>>) -> Result<SyncReceipt, String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    let started_at = now_string();
    let id = format!("sync-{}", now_millis());
    let local = call_tool_url(
        &settings.local_endpoint,
        None,
        &settings.tenant,
        "rustyred_thg_graph_version_compile",
        json!({ "ref": "desktop-local" }),
    );
    let hosted = bearer_token().ok().and_then(|token| {
        call_tool_url(
            &settings.endpoint,
            Some(&token),
            &settings.tenant,
            "rustyred_thg_graph_version_compile",
            json!({ "ref": "desktop-hosted" }),
        )
        .ok()
    });

    let (status, message): (String, String) = match (&local, &hosted) {
        (Ok(_), Some(_)) => (
            "ok".to_string(),
            "Sync round exchanged version packs.".to_string(),
        ),
        (Ok(_), None) => (
            "error".to_string(),
            "Local pack compiled; hosted pack unavailable without bearer or network.".to_string(),
        ),
        (Err(error), _) => ("error".to_string(), error.clone()),
    };

    Ok(SyncReceipt {
        id,
        status,
        started_at,
        finished_at: Some(now_string()),
        local_pack: local.as_ref().ok().and_then(|value| {
            value
                .get("pack_id")
                .or_else(|| value.get("id"))
                .and_then(Value::as_str)
                .map(str::to_string)
        }),
        hosted_pack: hosted.as_ref().and_then(|value| {
            value
                .get("pack_id")
                .or_else(|| value.get("id"))
                .and_then(Value::as_str)
                .map(str::to_string)
        }),
        merged_nodes: Some(0),
        merged_edges: Some(0),
        conflicts: Some(0),
        message,
    })
}

#[tauri::command]
fn background_fetch_receipt(input: BackgroundFetchInput) -> Result<(), String> {
    eprintln!(
        "[commonplace-desktop] background fetch warmup urls={} at {}",
        input.urls.len(),
        now_string()
    );
    Ok(())
}

#[tauri::command]
fn space_bind_room(
    input: SpaceBindInput,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    call_tool_url(
        &settings.endpoint,
        bearer_token().ok().as_deref(),
        &settings.tenant,
        "coordination_room",
        json!({
            "action": "join",
            "actor": "desktop",
            "room_id": input.room_id,
            "repo": "Travis-Gilbert/theorem",
            "branch": "main",
            "task": input.space_name,
            "surface": "desktop",
        }),
    )?;
    Ok(())
}

#[tauri::command]
fn room_context(
    room_id: String,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<RoomContext, String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    let payload = call_tool_url(
        &settings.endpoint,
        bearer_token().ok().as_deref(),
        &settings.tenant,
        "coordination_context",
        json!({ "room_id": room_id, "actor": "desktop", "limit": 30 }),
    )?;
    Ok(room_context_from_payload(&payload))
}

#[tauri::command]
fn room_post_message(
    input: RoomPostInput,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    call_tool_url(
        &settings.endpoint,
        bearer_token().ok().as_deref(),
        &settings.tenant,
        "coordinate",
        json!({
            "actor": "desktop",
            "room_id": input.room_id,
            "message": input.message,
            "urgency": "info",
        }),
    )?;
    Ok(())
}

#[tauri::command]
fn job_submit(
    input: JobSubmitInput,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    call_tool_url(
        &settings.endpoint,
        bearer_token().ok().as_deref(),
        &settings.tenant,
        "job_submit",
        json!({
            "title": input.title,
            "spec_ref": input.spec_ref,
            "repo": input.repo,
            "kind": input.kind,
            "priority": input.priority.unwrap_or_else(|| "P1".to_string()),
            "target_head": input.target_head.unwrap_or_else(|| "Either".to_string()),
            "actor": "desktop",
        }),
    )?;
    Ok(())
}

#[tauri::command]
fn queue_status(
    input: QueueStatusInput,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<Vec<QueueJob>, String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    let payload = call_tool_url(
        &settings.endpoint,
        bearer_token().ok().as_deref(),
        &settings.tenant,
        "queue_status",
        json!({ "repo": input.repo, "status": input.status }),
    )?;
    Ok(queue_jobs_from_payload(&payload))
}

#[tauri::command]
fn agent_tab_ingest(
    input: AgentTabIngestInput,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<AgentIngestionReceipt, String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    let captured_at = now_string();
    let title = input.title.clone().unwrap_or_else(|| input.url.clone());
    let remember_result = call_selected_tool(
        &settings,
        "remember",
        json!({
            "kind": "open_web_unverified",
            "title": title,
            "content": input.text,
            "tags": ["desktop-agent-tab", "open_web_unverified", domain_tag(&input.url)],
            "links": [input.url.clone()],
            "actor": "desktop",
            "surface": "desktop-agent-tab",
            "metadata": {
                "tab_id": input.tab_id,
                "trust_tier": "open_web_unverified",
                "capture_time": captured_at,
            },
        }),
    );
    let (message, object_id) = match &remember_result {
        Ok(payload) => (
            "Ingestion receipt written to the target store.".to_string(),
            first_string_field(payload, &["id", "node_id", "memory_id", "object_id"]),
        ),
        Err(error) => (format!("Ingestion failed: {error}"), None),
    };
    // Best-effort nearest neighbor for the Keep toast: recall by title and take
    // the top hit that is not the note just written. None on any failure; the
    // toast renders only real fields.
    let nearest_neighbor = if remember_result.is_ok() {
        call_selected_tool(&settings, "recall", json!({ "query": title, "limit": 3 }))
            .ok()
            .and_then(|payload| nearest_memory_title(&payload, object_id.as_deref(), &title))
    } else {
        None
    };

    Ok(AgentIngestionReceipt {
        id: format!("ingest-{}", now_millis()),
        status: if message.starts_with("Ingestion failed") {
            "error".to_string()
        } else {
            "ok".to_string()
        },
        url: input.url,
        title: input.title,
        captured_at,
        store_target: settings.active_target,
        trust_tier: "open_web_unverified".to_string(),
        message,
        object_id,
        nearest_neighbor,
    })
}

#[tauri::command]
fn connector_proof_run(
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<ConnectorProofResult, String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    let affordance_id = "theorem_grpc.code_search.search";
    let result = call_selected_tool(
        &settings,
        "code_search",
        json!({
            "operation": "search",
            "query": "Theorem Desktop connector proof",
            "repo_id": "Travis-Gilbert/theorem",
        }),
    );
    Ok(match result {
        Ok(_) => ConnectorProofResult {
            status: "ok".to_string(),
            affordance_id: affordance_id.to_string(),
            message: "MCP connector affordance invoked from the rail backend.".to_string(),
        },
        Err(error) => ConnectorProofResult {
            status: "error".to_string(),
            affordance_id: affordance_id.to_string(),
            message: error,
        },
    })
}

fn start_local_node(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    let store_path = app_store_path(app)?;
    std::fs::create_dir_all(&store_path).map_err(|error| error.to_string())?;

    let mut config = rustyred_thg_server::Config::from_env();
    config.host = "127.0.0.1".to_string();
    config.port = LOCAL_NODE_PORT;
    config.data_dir = store_path.display().to_string();
    config.require_volume = false;
    config.volume_available = true;
    config.require_auth = false;
    config.mcp_read_only = false;
    config.mcp_allow_admin = true;
    config.mcp_default_tenant = "Travis-Gilbert".to_string();
    config.allowed_origins = vec![
        "http://localhost:1420".to_string(),
        "http://127.0.0.1:1420".to_string(),
        "http://localhost:3000".to_string(),
        "http://127.0.0.1:3000".to_string(),
        "tauri://localhost".to_string(),
    ];

    let endpoint = format!("http://127.0.0.1:{LOCAL_NODE_PORT}/mcp");
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    tauri::async_runtime::spawn(async move {
        if let Err(error) = rustyred_thg_server::serve_loopback(config, shutdown_rx).await {
            eprintln!("[commonplace-desktop] local node stopped: {error}");
        }
    });

    let mut backend = state.lock().map_err(|error| error.to_string())?;
    backend.harness.local_endpoint = endpoint.clone();
    backend.local_node = Some(LocalNodeRuntime {
        endpoint,
        store_path: store_path.display().to_string(),
        shutdown: Some(shutdown_tx),
    });
    Ok(())
}

fn commonplace_is_healthy(endpoint: &str) -> bool {
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(250))
        .build()
        .ok()
        .and_then(|client| client.get(format!("{endpoint}/healthz")).send().ok())
        .and_then(|response| response.error_for_status().ok())
        .is_some()
}

fn wait_for_commonplace_health(endpoint: &str) -> Result<(), String> {
    for _ in 0..20 {
        if commonplace_is_healthy(endpoint) {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(25));
    }
    Err(format!(
        "commonplace-api health check failed at {endpoint}/healthz"
    ))
}

fn start_commonplace_api(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<(), String> {
    let store_path = app_store_path(app)?.join("commonplace-api");
    std::fs::create_dir_all(&store_path).map_err(|error| error.to_string())?;

    let addr: std::net::SocketAddr = ([127, 0, 0, 1], COMMONPLACE_NODE_PORT).into();
    let endpoint = format!("http://127.0.0.1:{COMMONPLACE_NODE_PORT}");
    let (shutdown_tx, shutdown_rx) = oneshot::channel();
    let (ready_tx, ready_rx) = std::sync::mpsc::sync_channel(1);
    let spawn_store_path = store_path.clone();
    tauri::async_runtime::spawn(async move {
        let shutdown = async move {
            let _ = shutdown_rx.await;
        };
        if let Err(error) = commonplace_api::serve_loopback_with_ready(
            addr,
            spawn_store_path,
            "dev-key",
            "default",
            ready_tx,
            shutdown,
        )
        .await
        {
            eprintln!("[commonplace-desktop] commonplace-api stopped: {error}");
        }
    });

    match ready_rx.recv() {
        Ok(Ok(())) => {}
        Ok(Err(error)) => return Err(error),
        Err(error) => {
            return Err(format!(
                "commonplace-api startup ended before readiness signal: {error}"
            ))
        }
    }
    if let Err(error) = wait_for_commonplace_health(&endpoint) {
        let _ = shutdown_tx.send(());
        return Err(error);
    }

    let mut backend = state.lock().map_err(|error| error.to_string())?;
    backend.commonplace_node = Some(CommonplaceRuntime {
        endpoint,
        store_path: store_path.display().to_string(),
        shutdown: Some(shutdown_tx),
    });
    Ok(())
}

#[tauri::command]
fn commonplace_status(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<CommonplaceStatus, String> {
    let backend = state.lock().map_err(|error| error.to_string())?;
    let fallback_store = app_store_path(&app)?.join("commonplace-api");
    let endpoint = backend
        .commonplace_node
        .as_ref()
        .map(|node| node.endpoint.clone())
        .unwrap_or_else(|| format!("http://127.0.0.1:{COMMONPLACE_NODE_PORT}"));
    let store_path = backend
        .commonplace_node
        .as_ref()
        .map(|node| node.store_path.clone())
        .unwrap_or_else(|| fallback_store.display().to_string());
    let node_up = backend
        .commonplace_node
        .as_ref()
        .map(|_| commonplace_is_healthy(&endpoint))
        .unwrap_or(false);

    Ok(CommonplaceStatus {
        node_up,
        endpoint,
        port: COMMONPLACE_NODE_PORT,
        store_path,
    })
}

#[tauri::command]
fn hosted_connection_status(
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<HostedConnectionStatus, String> {
    let settings = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    let bearer = bearer_token().ok();
    let bearer_present = bearer.is_some();
    if !bearer_present {
        return Ok(HostedConnectionStatus {
            endpoint: settings.endpoint,
            tenant: settings.tenant,
            bearer_present,
            reachable: false,
            document_count: None,
            message: "No hosted bearer token stored.".to_string(),
        });
    }
    match tools_list(&settings.endpoint, bearer.as_deref()) {
        Ok(tools) => Ok(HostedConnectionStatus {
            endpoint: settings.endpoint,
            tenant: settings.tenant,
            bearer_present,
            reachable: true,
            document_count: None,
            message: format!("Hosted harness reachable ({} tools).", tools.len()),
        }),
        Err(error) => Ok(HostedConnectionStatus {
            endpoint: settings.endpoint,
            tenant: settings.tenant,
            bearer_present,
            reachable: false,
            document_count: None,
            message: error,
        }),
    }
}

#[tauri::command]
fn model_status() -> Result<ModelStatus, String> {
    let protocol = std::env::var("THEOREM_LOCAL_AGENT_PROTOCOL")
        .unwrap_or_else(|_| "openai".to_string())
        .to_ascii_lowercase();
    let endpoint = if protocol == "ollama" {
        std::env::var("THEOREM_OLLAMA_ENDPOINT")
            .unwrap_or_else(|_| "http://127.0.0.1:11434".to_string())
    } else {
        std::env::var("THEOREM_LOCAL_OPENAI_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:8080/v1/chat/completions".to_string())
    };
    let model = std::env::var("THEOREM_LOCAL_MODEL")
        .or_else(|_| std::env::var("OLLAMA_MODEL"))
        .unwrap_or_else(|_| "gemma3:latest".to_string());
    let reachable = if protocol == "ollama" {
        ollama_is_reachable(&endpoint)
    } else {
        openai_compatible_is_reachable(&endpoint)
    };
    Ok(ModelStatus {
        enabled: true,
        endpoint,
        model,
        reachable,
        message: if reachable {
            format!("{protocol} local agent reachable")
        } else {
            format!("{protocol} local agent not reachable")
        },
    })
}

fn stop_local_node(state: &tauri::State<'_, Mutex<DesktopBackendState>>) {
    if let Ok(mut backend) = state.lock() {
        if let Some(mut node) = backend.local_node.take() {
            if let Some(shutdown) = node.shutdown.take() {
                let _ = shutdown.send(());
            }
        }
        if let Some(mut node) = backend.commonplace_node.take() {
            if let Some(shutdown) = node.shutdown.take() {
                let _ = shutdown.send(());
            }
        }
        stop_receiver_locked(&mut backend);
    }
}

fn start_receiver_locked(backend: &mut DesktopBackendState) -> Result<(), String> {
    if backend.receiver_runtime.is_some() {
        return Ok(());
    }
    let lanes = theorem_receiver::detect_lanes();
    if lanes.is_empty() {
        return Err("no receiver lanes detected".to_string());
    }
    let token = bearer_token()
        .or_else(|_| std::env::var("THEOREM_HARNESS_TOKEN").map_err(|error| error.to_string()))?;
    let worktrees = backend
        .receiver
        .worktrees
        .iter()
        .map(|(repo, path)| (repo.clone(), PathBuf::from(path)))
        .collect::<BTreeMap<_, _>>();
    let config = theorem_receiver::ReceiverConfig {
        harness_url: backend.harness.endpoint.clone(),
        tenant_slug: backend.harness.tenant.clone(),
        receiver_id: Some("commonplace-desktop-receiver".to_string()),
        claim_interval_secs: backend.receiver.claim_interval_secs,
        capacity: 1,
        dispatch_database_url_env: theorem_receiver::config::DEFAULT_DISPATCH_DATABASE_URL_ENV
            .to_string(),
        dispatch_lease_secs: theorem_receiver::config::DEFAULT_DISPATCH_LEASE_SECS,
        dispatch_heartbeat_secs: theorem_receiver::config::DEFAULT_DISPATCH_HEARTBEAT_SECS,
        dispatch_reap_interval_secs: theorem_receiver::config::DEFAULT_DISPATCH_REAP_INTERVAL_SECS,
        worktrees,
        provider_seam: theorem_receiver::ProviderSeamConfig::default(),
        model_backends: BTreeMap::new(),
        head_runtime_recipes: BTreeMap::new(),
        sandbox: None,
    };
    let stop = Arc::new(AtomicBool::new(false));
    let status = Arc::new(Mutex::new(ReceiverThreadStatus {
        state: "running".to_string(),
        ..ReceiverThreadStatus::default()
    }));
    let thread_stop = stop.clone();
    let thread_status = status.clone();
    let handle = std::thread::spawn(move || {
        let client = match theorem_receiver::HarnessClient::new(
            config.harness_url.clone(),
            Some(token),
            config.tenant_slug.clone(),
        ) {
            Ok(client) => client,
            Err(error) => {
                if let Ok(mut status) = thread_status.lock() {
                    status.state = "error".to_string();
                    status.error = Some(error.to_string());
                }
                return;
            }
        };
        let result = theorem_receiver::run_loop_until(&config, &client, || {
            thread_stop.load(Ordering::Relaxed)
        });
        if let Ok(mut status) = thread_status.lock() {
            match result {
                Ok(()) => status.state = "off".to_string(),
                Err(error) => {
                    status.state = "error".to_string();
                    status.error = Some(error.to_string());
                }
            }
        }
    });
    backend.receiver_runtime = Some(ReceiverRuntime {
        stop,
        handle: Some(handle),
        status,
    });
    Ok(())
}

fn stop_receiver_locked(backend: &mut DesktopBackendState) {
    if let Some(mut runtime) = backend.receiver_runtime.take() {
        runtime.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = runtime.handle.take() {
            let _ = handle.join();
        }
    }
}

fn ensure_tab_window(
    app: &tauri::AppHandle,
    state: &tauri::State<'_, Mutex<DesktopBackendState>>,
    tab_id: &str,
    url: &str,
) -> Result<(), String> {
    let label = tab_label(tab_id);
    if app.get_webview_window(&label).is_none() {
        let parsed = tauri::Url::parse(url).map_err(|error| error.to_string())?;
        let nav_app = app.clone();
        let nav_tab_id = tab_id.to_string();
        let window = WebviewWindowBuilder::new(app, label.clone(), WebviewUrl::External(parsed))
            .title(url)
            .visible(false)
            // Tab lifecycle to the chrome webview (HANDOFF-COBROWSE-PRESENCE D6):
            // the receipt rail and telegraph clear on committed navigations.
            .on_navigation(move |nav_url| {
                let _ = nav_app.emit(
                    "cobrowse://navigation",
                    json!({ "tabId": nav_tab_id, "url": nav_url.to_string() }),
                );
                true
            })
            .build()
            .map_err(|error| error.to_string())?;
        let _ = window.hide();
    }
    let mut backend = state.lock().map_err(|error| error.to_string())?;
    backend.tabs.insert(
        tab_id.to_string(),
        TabRuntime {
            label,
            url: url.to_string(),
            title: url.to_string(),
        },
    );
    Ok(())
}

fn tab_label(tab_id: &str) -> String {
    format!(
        "tab-{}",
        tab_id
            .chars()
            .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
            .collect::<String>()
    )
}

fn app_store_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .resolve("store", BaseDirectory::AppData)
        .map_err(|error| error.to_string())
}

mod site_policy;
mod margin_recall;

/// D1 pageIdentity (MR-D1-4): the co-browsed page's url and title plus its BLAKE3 content
/// hash, over the same server-side text source `extract_visible_text` uses. Stable across an
/// unchanged revisit; the shared key for the D2 result cache and D3 anchor.
#[tauri::command]
fn page_identity(
    tab_id: String,
    state: tauri::State<'_, Mutex<DesktopBackendState>>,
) -> Result<margin_recall::PageIdentity, String> {
    let tab = state
        .lock()
        .map_err(|error| error.to_string())?
        .tabs
        .get(&tab_id)
        .cloned();
    let Some(tab) = tab else {
        return Ok(margin_recall::page_identity(String::new(), String::new(), ""));
    };
    let text = if tab.url.starts_with("http://") || tab.url.starts_with("https://") {
        fetch_text(&tab.url).unwrap_or_default()
    } else {
        String::new()
    };
    Ok(margin_recall::page_identity(tab.url, tab.title, &text))
}

/// D1 resolveTextTargets (MR-D1-1): inject the resolver that finds `target` in the page and
/// posts its rects back through the Tauri IPC. Fire-and-forget: the rects arrive via the
/// `margin_recall_targets` postback, re-emitted on `marginrecall://targets`.
#[tauri::command]
fn resolve_text_targets(
    app: tauri::AppHandle,
    tab_id: String,
    request_id: String,
    target: margin_recall::TextTarget,
) -> Result<(), String> {
    let window = app
        .get_webview_window(&tab_label(&tab_id))
        .ok_or_else(|| format!("tab window for {tab_id} missing"))?;
    window
        .eval(&margin_recall::resolve_script(&request_id, &target))
        .map_err(|error| error.to_string())
}

/// D1 scrollToTarget (MR-D1-3): scroll the resolved passage into view.
#[tauri::command]
fn scroll_to_target(
    app: tauri::AppHandle,
    tab_id: String,
    target: margin_recall::TextTarget,
) -> Result<(), String> {
    let window = app
        .get_webview_window(&tab_label(&tab_id))
        .ok_or_else(|| format!("tab window for {tab_id} missing"))?;
    window
        .eval(&margin_recall::scroll_script(&target))
        .map_err(|error| error.to_string())
}

/// Postback sink for the injected resolver (MR-D1-1): parse the rects it posts back and
/// re-emit them to the web layer on `marginrecall://targets`, tagged with the request id.
#[tauri::command]
fn margin_recall_targets(app: tauri::AppHandle, payload: String) -> Result<(), String> {
    let parsed = margin_recall::parse_targets_payload(&payload)?;
    app.emit(margin_recall::TARGETS_EVENT, parsed)
        .map_err(|error| error.to_string())
}

/// D4-5 external-page tint: paint a faint, click-through tint over the D1-resolved rects on an
/// external co-browse page, extending `tab_highlight` from an element bbox to a text range.
#[tauri::command]
fn tab_tint_targets(
    app: tauri::AppHandle,
    tab_id: String,
    targets: Vec<margin_recall::RectSet>,
    tier: String,
) -> Result<(), String> {
    let window = app
        .get_webview_window(&tab_label(&tab_id))
        .ok_or_else(|| format!("tab window for {tab_id} missing"))?;
    window
        .eval(&margin_recall::tint_script(&targets, &tier))
        .map_err(|error| error.to_string())
}

/// Clear the external-page margin tint (MR-D4-5).
#[tauri::command]
fn tab_clear_tint(app: tauri::AppHandle, tab_id: String) -> Result<(), String> {
    let window = app
        .get_webview_window(&tab_label(&tab_id))
        .ok_or_else(|| format!("tab window for {tab_id} missing"))?;
    window
        .eval(&margin_recall::clear_tint_script())
        .map_err(|error| error.to_string())
}

/// D7: the per-site recall override for `origin` (`"off"`|`"quiet"`|`"active"`), or
/// `None` when the site inherits the dial. Contract doc: apps/desktop/src/lib/commands.ts.
#[tauri::command]
fn site_policy_get(app: tauri::AppHandle, origin: String) -> Result<Option<String>, String> {
    let db = open_db(&app)?;
    site_policy::ensure_table(&db).map_err(|error| error.to_string())?;
    Ok(site_policy::get_policy(&db, &origin)
        .map_err(|error| error.to_string())?
        .map(|policy| policy.as_str().to_string()))
}

/// D7: pin `origin` to a recall policy. A site set to `"off"` suppresses the salience
/// pipeline for that origin whatever the dial says.
#[tauri::command]
fn site_policy_set(app: tauri::AppHandle, origin: String, policy: String) -> Result<(), String> {
    let parsed = site_policy::RecallPolicy::parse(&policy)
        .ok_or_else(|| format!("unknown recall policy {policy}"))?;
    let db = open_db(&app)?;
    site_policy::ensure_table(&db).map_err(|error| error.to_string())?;
    site_policy::set_policy(&db, &origin, parsed).map_err(|error| error.to_string())
}

fn open_db(app: &tauri::AppHandle) -> Result<Connection, String> {
    let store = app_store_path(app)?;
    std::fs::create_dir_all(&store).map_err(|error| error.to_string())?;
    let db = Connection::open(store.join("desktop.sqlite")).map_err(|error| error.to_string())?;
    db.execute(
        "create table if not exists kv (key text primary key, value text not null)",
        [],
    )
    .map_err(|error| error.to_string())?;
    Ok(db)
}

fn keychain_entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYCHAIN_SERVICE, account).map_err(|error| error.to_string())
}

fn secret_set(account: &str, secret: &str) -> Result<(), String> {
    keychain_entry(account)?
        .set_password(secret)
        .map_err(|error| error.to_string())
}

fn secret_get(account: &str) -> Result<String, String> {
    keychain_entry(account)?
        .get_password()
        .map_err(|error| error.to_string())
}

fn secret_delete(account: &str) -> Result<(), String> {
    keychain_entry(account)?
        .delete_credential()
        .map_err(|error| error.to_string())
}

fn bearer_token() -> Result<String, String> {
    secret_get("harness_bearer")
        .or_else(|_| std::env::var("THEOREM_HARNESS_TOKEN").map_err(|error| error.to_string()))
}

/// First string value under any of `keys`, looking at the payload root and one
/// level down through the common envelope keys tool responses use.
fn first_string_field(payload: &Value, keys: &[&str]) -> Option<String> {
    let candidates = std::iter::once(payload).chain(
        ["result", "data", "memory", "note", "record"]
            .iter()
            .filter_map(|envelope| payload.get(envelope)),
    );
    for value in candidates {
        for key in keys {
            if let Some(found) = value.get(key).and_then(Value::as_str) {
                return Some(found.to_string());
            }
        }
    }
    None
}

/// Title of the top recall hit that is not the note just written. Tolerant of
/// the envelope and list key varying across store versions; None when nothing
/// usable comes back.
fn nearest_memory_title(
    payload: &Value,
    written_id: Option<&str>,
    written_title: &str,
) -> Option<String> {
    let list = ["results", "memories", "items", "hits", "records"]
        .iter()
        .find_map(|key| {
            payload
                .get(key)
                .or_else(|| payload.get("result").and_then(|result| result.get(key)))
                .and_then(Value::as_array)
        })?;
    list.iter().find_map(|hit| {
        let id = first_string_field(hit, &["id", "node_id", "memory_id"]);
        if id.is_some() && id.as_deref() == written_id {
            return None;
        }
        first_string_field(hit, &["title", "label", "name"])
            .filter(|candidate| candidate != written_title)
    })
}

fn call_selected_tool(
    settings: &HarnessSettings,
    name: &str,
    arguments: Value,
) -> Result<Value, String> {
    if settings.active_target == "local" {
        call_tool_url(
            &settings.local_endpoint,
            None,
            &settings.tenant,
            name,
            arguments,
        )
    } else {
        let token = bearer_token().ok();
        call_tool_url(
            &settings.endpoint,
            token.as_deref(),
            &settings.tenant,
            name,
            arguments,
        )
    }
}

fn call_tool_url(
    url: &str,
    token: Option<&str>,
    tenant: &str,
    name: &str,
    mut arguments: Value,
) -> Result<Value, String> {
    if let Value::Object(map) = &mut arguments {
        map.insert("tenant_slug".to_string(), json!(tenant));
    }
    let body = json!({
        "jsonrpc": "2.0",
        "id": now_millis(),
        "method": "tools/call",
        "params": { "name": name, "arguments": arguments },
    });
    let client = reqwest::blocking::Client::builder()
        .build()
        .map_err(|error| error.to_string())?;
    let mut request = client.post(url).json(&body);
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    let response = request
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| error.to_string())?;
    let value: Value = response.json().map_err(|error| error.to_string())?;
    parse_tool_response(&value)
}

fn call_method_url(
    url: &str,
    token: Option<&str>,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    let body = json!({
        "jsonrpc": "2.0",
        "id": now_millis(),
        "method": method,
        "params": params,
    });
    let client = reqwest::blocking::Client::builder()
        .build()
        .map_err(|error| error.to_string())?;
    let mut request = client.post(url).json(&body);
    if let Some(token) = token {
        request = request.bearer_auth(token);
    }
    let response = request
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| error.to_string())?;
    response.json().map_err(|error| error.to_string())
}

fn parse_tool_response(value: &Value) -> Result<Value, String> {
    if let Some(error) = value.get("error") {
        return Err(format!("jsonrpc error: {error}"));
    }
    let Some(text) = value
        .get("result")
        .and_then(|result| result.get("content"))
        .and_then(Value::as_array)
        .and_then(|content| content.first())
        .and_then(|entry| entry.get("text"))
        .and_then(Value::as_str)
    else {
        return Ok(value
            .get("result")
            .cloned()
            .unwrap_or_else(|| value.clone()));
    };
    let payload: Value = serde_json::from_str(text).map_err(|error| error.to_string())?;
    if payload.get("result").is_none() {
        if let Some(message) = payload.get("message").and_then(Value::as_str) {
            return Err(message.to_string());
        }
        if payload.get("error").is_some() {
            return Err(payload.to_string());
        }
    }
    Ok(payload.get("result").cloned().unwrap_or(payload))
}

fn tools_match_hosted(settings: &HarnessSettings) -> Result<bool, String> {
    let local = tools_list(&settings.local_endpoint, None)?;
    let token = bearer_token().ok();
    let hosted = tools_list(&settings.endpoint, token.as_deref())?;
    Ok(local == hosted)
}

fn tools_list(url: &str, token: Option<&str>) -> Result<Vec<String>, String> {
    let value = call_method_url(url, token, "tools/list", json!({}))?;
    let mut tools = value
        .get("result")
        .and_then(|result| result.get("tools"))
        .and_then(Value::as_array)
        .map(|tools| tools.as_slice())
        .unwrap_or(&[])
        .iter()
        .filter_map(|tool| tool.get("name").and_then(Value::as_str).map(str::to_string))
        .collect::<Vec<_>>();
    tools.sort();
    Ok(tools)
}

fn recall_hits(payload: &Value) -> Vec<RecallHit> {
    payload
        .get("results")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(|item| {
            let id = string_at(item, &["id", "doc_id", "node_id"])
                .unwrap_or_else(|| "memory".to_string());
            let title =
                string_at(item, &["title", "summary"]).unwrap_or_else(|| "Memory".to_string());
            let snippet = string_at(item, &["snippet", "content", "summary"]).unwrap_or_default();
            let tags = item
                .get("tags")
                .and_then(Value::as_array)
                .into_iter()
                .flatten()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect();
            RecallHit {
                id,
                title,
                snippet,
                tags,
                url: string_at(item, &["url"]),
                created_at: None,
            }
        })
        .collect()
}

fn room_context_from_payload(payload: &Value) -> RoomContext {
    let feed = payload
        .get("messages")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(|item| RoomFeedItem {
            id: string_at(item, &["message_id", "id"])
                .unwrap_or_else(|| format!("msg-{}", now_millis())),
            actor: string_at(item, &["actor_id", "actor"]).unwrap_or_else(|| "unknown".to_string()),
            text: string_at(item, &["message", "content"]).unwrap_or_default(),
            created_at: string_at(item, &["created_at", "createdAt"]),
            kind: Some("message".to_string()),
        })
        .collect();
    let participants = payload
        .get("presence")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(|item| RoomParticipant {
            actor: string_at(item, &["actor_id", "actor"]).unwrap_or_else(|| "unknown".to_string()),
            status: string_at(item, &["status"]).unwrap_or_else(|| "active".to_string()),
            last_seen: string_at(item, &["refreshed_at", "updated_at", "created_at"]),
        })
        .collect();
    let intents = payload
        .get("intents")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(|item| RoomIntentItem {
            actor: string_at(item, &["actor_id", "actor"]).unwrap_or_else(|| "unknown".to_string()),
            status: string_at(item, &["status"]).unwrap_or_else(|| "working".to_string()),
            summary: string_at(item, &["summary"]).unwrap_or_default(),
            footprint: string_array_at(item, &["footprint", "claimed_files", "claimedFiles"]),
            updated_at: string_at(item, &["updated_at", "updatedAt", "created_at"]),
            expected_completion: string_at(item, &["expected_completion", "expectedCompletion"]),
            repo: string_at(item, &["repo"]),
            branch: string_at(item, &["branch"]),
            task: string_at(item, &["task"]),
        })
        .collect();
    let records = payload
        .get("records")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(|item| RoomRecordItem {
            id: string_at(item, &["record_id", "recordId", "id"])
                .unwrap_or_else(|| format!("record-{}", now_millis())),
            kind: string_at(item, &["record_type", "recordType", "kind"])
                .unwrap_or_else(|| "event".to_string()),
            actor: string_at(item, &["actor_id", "actor"]),
            title: string_at(item, &["title"]),
            summary: string_at(item, &["summary", "title", "body"]).unwrap_or_default(),
            body: string_at(item, &["body"]),
            refs: string_array_at(item, &["refs", "source_refs", "sourceRefs"]),
            created_at: string_at(item, &["created_at", "createdAt"]),
        })
        .collect();
    RoomContext {
        feed,
        participants,
        intents,
        records,
    }
}

fn queue_jobs_from_payload(payload: &Value) -> Vec<QueueJob> {
    payload
        .get("jobs")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .map(|item| QueueJob {
            job_id: string_at(item, &["job_id", "jobId"]).unwrap_or_default(),
            title: string_at(item, &["title"]).unwrap_or_default(),
            status: string_at(item, &["status"]).unwrap_or_default(),
            target_head: string_at(item, &["target_head", "targetHead"]),
            priority: string_at(item, &["priority"]),
            age: string_at(item, &["age"]),
        })
        .collect()
}

fn call_composed_agent_chat(settings: &HarnessSettings, task: &str) -> Result<String, String> {
    let payload = call_selected_tool(
        settings,
        "composed_agent_run",
        json!({
            "bindingId": "agent:theorem",
            "task": task,
        }),
    )?;
    Ok(composed_agent_text(&payload).unwrap_or_else(|| payload.to_string()))
}

fn composed_agent_text(payload: &Value) -> Option<String> {
    let result = payload.get("result").unwrap_or(payload);
    result
        .get("invocation_receipts")
        .and_then(Value::as_array)
        .and_then(|receipts| {
            receipts.iter().rev().find_map(|receipt| {
                receipt
                    .pointer("/payload/text")
                    .or_else(|| receipt.pointer("/payload/content"))
                    .and_then(Value::as_str)
                    .or_else(|| receipt.get("output_summary").and_then(Value::as_str))
                    .map(str::to_string)
            })
        })
        .or_else(|| {
            let claims = result.get("published_claims")?.as_array()?;
            let text = claims
                .iter()
                .filter_map(|claim| claim.get("text").and_then(Value::as_str))
                .collect::<Vec<_>>()
                .join("\n");
            if text.trim().is_empty() {
                None
            } else {
                Some(text)
            }
        })
}

#[derive(Clone, Copy)]
struct ProviderChatProfile {
    provider: &'static str,
    key_env: &'static str,
    endpoint_env: &'static str,
    base_url_env: &'static str,
    model_env: &'static str,
    default_endpoint: &'static str,
    default_model: &'static str,
    base_uses_v1_path: bool,
}

fn provider_chat_profile(provider: &str) -> Option<ProviderChatProfile> {
    match provider.trim().to_ascii_lowercase().as_str() {
        "deepseek" => Some(ProviderChatProfile {
            provider: "deepseek",
            key_env: "DEEPSEEK_API_KEY",
            endpoint_env: "DEEPSEEK_CHAT_URL",
            base_url_env: "DEEPSEEK_BASE_URL",
            model_env: "DEEPSEEK_MODEL",
            default_endpoint: "https://api.deepseek.com/chat/completions",
            default_model: "deepseek-v4-pro",
            base_uses_v1_path: false,
        }),
        "mistral" => Some(ProviderChatProfile {
            provider: "mistral",
            key_env: "MISTRAL_API_KEY",
            endpoint_env: "MISTRAL_CHAT_URL",
            base_url_env: "MISTRAL_BASE_URL",
            model_env: "MISTRAL_MODEL",
            default_endpoint: "https://api.mistral.ai/v1/chat/completions",
            default_model: "mistral-large-latest",
            base_uses_v1_path: true,
        }),
        "minimax" => Some(ProviderChatProfile {
            provider: "minimax",
            key_env: "MINIMAX_API_KEY",
            endpoint_env: "MINIMAX_CHAT_URL",
            base_url_env: "MINIMAX_BASE_URL",
            model_env: "MINIMAX_MODEL",
            default_endpoint: "https://api.minimaxi.com/v1/chat/completions",
            default_model: "MiniMax-M3",
            base_uses_v1_path: true,
        }),
        "openai" | "openapi" => Some(ProviderChatProfile {
            provider: "openai",
            key_env: "OPENAI_API_KEY",
            endpoint_env: "OPENAI_CHAT_URL",
            base_url_env: "OPENAI_BASE_URL",
            model_env: "OPENAI_MODEL",
            default_endpoint: "https://api.openai.com/v1/chat/completions",
            default_model: "gpt-4.1-mini",
            base_uses_v1_path: true,
        }),
        _ => None,
    }
}

fn call_provider_chat(
    profile: ProviderChatProfile,
    input: &ModelChatInput,
) -> Result<(String, String), String> {
    let key = std::env::var(profile.key_env)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            format!(
                "{} requires {} in the CommonPlace desktop runtime environment",
                profile.provider, profile.key_env
            )
        })?;
    let endpoint = provider_chat_url(profile);
    let model = std::env::var(profile.model_env)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| profile.default_model.to_string());
    let messages = input
        .messages
        .iter()
        .map(|message| json!({ "role": message.role, "content": message.content }))
        .collect::<Vec<_>>();
    let response = reqwest::blocking::Client::new()
        .post(endpoint)
        .bearer_auth(key)
        .json(&json!({ "model": model.clone(), "messages": messages, "stream": false }))
        .send()
        .map_err(|error| error.to_string())?;
    let status = response.status();
    let value: Value = response.json().map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!(
            "{} provider HTTP {}: {}",
            profile.provider,
            status.as_u16(),
            provider_error_detail(&value)
        ));
    }
    let content = openai_chat_content(&value)
        .ok_or_else(|| format!("{} returned no message content", profile.provider))?;
    Ok((content, model))
}

fn provider_chat_url(profile: ProviderChatProfile) -> String {
    std::env::var(profile.endpoint_env)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .or_else(|| {
            std::env::var(profile.base_url_env)
                .ok()
                .map(|value| normalize_provider_chat_url(&value, profile.base_uses_v1_path))
        })
        .unwrap_or_else(|| profile.default_endpoint.to_string())
}

fn normalize_provider_chat_url(endpoint: &str, base_uses_v1_path: bool) -> String {
    let trimmed = endpoint.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/chat/completions")
    } else if base_uses_v1_path {
        format!("{trimmed}/v1/chat/completions")
    } else {
        format!("{trimmed}/chat/completions")
    }
}

fn provider_error_detail(value: &Value) -> String {
    value
        .pointer("/error/message")
        .and_then(Value::as_str)
        .or_else(|| value.get("message").and_then(Value::as_str))
        .or_else(|| value.get("error").and_then(Value::as_str))
        .unwrap_or("provider returned an error")
        .to_string()
}

fn openai_chat_content(value: &Value) -> Option<String> {
    value
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

fn call_local_chat(input: &ModelChatInput) -> Result<String, String> {
    match local_protocol(input).as_str() {
        "ollama" => call_ollama(input),
        _ => call_openai_compatible(input),
    }
}

fn local_protocol(input: &ModelChatInput) -> String {
    input
        .local_protocol
        .clone()
        .or_else(|| input.ollama_endpoint.as_ref().map(|_| "ollama".to_string()))
        .or_else(|| std::env::var("THEOREM_LOCAL_AGENT_PROTOCOL").ok())
        .unwrap_or_else(|| "openai".to_string())
        .to_ascii_lowercase()
}

fn local_model_name(input: &ModelChatInput, fallback: &str) -> String {
    input
        .local_model
        .clone()
        .or_else(|| input.ollama_model.clone())
        .or_else(|| std::env::var("THEOREM_LOCAL_MODEL").ok())
        .or_else(|| std::env::var("OLLAMA_MODEL").ok())
        .unwrap_or_else(|| fallback.to_string())
}

fn call_ollama(input: &ModelChatInput) -> Result<String, String> {
    let endpoint = input
        .ollama_endpoint
        .clone()
        .or_else(|| input.local_endpoint.clone())
        .or_else(|| std::env::var("THEOREM_OLLAMA_ENDPOINT").ok())
        .unwrap_or_else(|| "http://127.0.0.1:11434".to_string());
    let endpoint = endpoint.trim_end_matches('/');
    let model = local_model_name(input, "llama3.2");
    let messages = input
        .messages
        .iter()
        .map(|message| json!({ "role": message.role, "content": message.content }))
        .collect::<Vec<_>>();
    let response: Value = reqwest::blocking::Client::new()
        .post(format!("{endpoint}/api/chat"))
        .json(&json!({ "model": model, "messages": messages, "stream": false }))
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| error.to_string())?
        .json()
        .map_err(|error| error.to_string())?;
    Ok(response
        .pointer("/message/content")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string())
}

fn call_openai_compatible(input: &ModelChatInput) -> Result<String, String> {
    let endpoint = input
        .local_endpoint
        .clone()
        .or_else(|| std::env::var("THEOREM_LOCAL_OPENAI_URL").ok())
        .unwrap_or_else(|| "http://127.0.0.1:8080/v1/chat/completions".to_string());
    let url = normalize_openai_chat_url(&endpoint);
    let model = local_model_name(input, "gemma3:latest");
    let messages = input
        .messages
        .iter()
        .map(|message| json!({ "role": message.role, "content": message.content }))
        .collect::<Vec<_>>();
    let response: Value = reqwest::blocking::Client::new()
        .post(url)
        .json(&json!({ "model": model, "messages": messages, "stream": false }))
        .send()
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| error.to_string())?
        .json()
        .map_err(|error| error.to_string())?;
    response
        .pointer("/choices/0/message/content")
        .and_then(Value::as_str)
        .filter(|text| !text.trim().is_empty())
        .map(str::to_string)
        .ok_or_else(|| "local OpenAI-compatible endpoint returned no message content".to_string())
}

fn normalize_openai_chat_url(endpoint: &str) -> String {
    let trimmed = endpoint.trim().trim_end_matches('/');
    if trimmed.ends_with("/chat/completions") {
        trimmed.to_string()
    } else if trimmed.ends_with("/v1") {
        format!("{trimmed}/chat/completions")
    } else {
        format!("{trimmed}/v1/chat/completions")
    }
}

fn openai_compatible_is_reachable(endpoint: &str) -> bool {
    let url = normalize_openai_chat_url(endpoint)
        .trim_end_matches("/chat/completions")
        .to_string()
        + "/models";
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(400))
        .build()
        .ok()
        .and_then(|client| client.get(url).send().ok())
        .and_then(|response| response.error_for_status().ok())
        .is_some()
}

fn ollama_is_reachable(endpoint: &str) -> bool {
    let endpoint = endpoint.trim_end_matches('/');
    reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(400))
        .build()
        .ok()
        .and_then(|client| client.get(format!("{endpoint}/api/tags")).send().ok())
        .and_then(|response| response.error_for_status().ok())
        .is_some()
}

fn fetch_text(url: &str) -> Result<String, String> {
    let body = reqwest::blocking::get(url)
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|error| error.to_string())?
        .text()
        .map_err(|error| error.to_string())?;
    Ok(strip_html(&body).chars().take(24_000).collect())
}

fn strip_html(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut in_tag = false;
    for ch in input.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => {
                in_tag = false;
                out.push(' ');
            }
            _ if !in_tag => out.push(ch),
            _ => {}
        }
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn string_at(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_str).map(str::to_string))
}

fn string_array_at(value: &Value, keys: &[&str]) -> Vec<String> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_array))
        .into_iter()
        .flatten()
        .filter_map(Value::as_str)
        .filter(|entry| !entry.trim().is_empty())
        .map(str::to_string)
        .collect()
}

fn domain_tag(url: &str) -> String {
    let domain = tauri::Url::parse(url)
        .ok()
        .and_then(|url| url.host_str().map(str::to_string))
        .unwrap_or_else(|| url.to_string());
    format!("domain:{domain}")
}

fn estimate_tokens(text: &str) -> u64 {
    ((text.chars().count() as f64) / 4.0).ceil().max(1.0) as u64
}

fn estimate_cost_usd(provider: &str, tokens_in: u64, tokens_out: u64) -> f64 {
    let (input_per_million, output_per_million) = match provider {
        "anthropic" => (3.0, 15.0),
        "openai" => (5.0, 15.0),
        "deepseek" => (0.14, 0.28),
        _ => (0.0, 0.0),
    };
    (tokens_in as f64 / 1_000_000.0 * input_per_million)
        + (tokens_out as f64 / 1_000_000.0 * output_per_million)
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn now_string() -> String {
    format!("unix_ms:{}", now_millis())
}

pub fn run(context: tauri::Context<tauri::Wry>) {
    tauri::Builder::default()
        .manage(Mutex::new(DesktopBackendState::default()))
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = app.state::<Mutex<DesktopBackendState>>();
            start_local_node(app.handle(), &state)?;
            start_commonplace_api(app.handle(), &state)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                let state = window.state::<Mutex<DesktopBackendState>>();
                stop_local_node(&state);
            }
            // A tab window gaining OS focus is the user-input-into-the-stage
            // signal (HANDOFF-COBROWSE-PRESENCE D4): external-URL webviews
            // cannot report in-page pointer or key events, but the first click
            // or keystroke into the stage necessarily focuses its window.
            if matches!(event, tauri::WindowEvent::Focused(true))
                && window.label().starts_with("tab-")
            {
                let tab_id = {
                    let state = window.state::<Mutex<DesktopBackendState>>();
                    let backend = state.lock().ok();
                    backend.and_then(|backend| {
                        backend
                            .tabs
                            .iter()
                            .find(|(_, tab)| tab.label == window.label())
                            .map(|(id, _)| id.clone())
                    })
                };
                if let Some(tab_id) = tab_id {
                    let _ = window
                        .app_handle()
                        .emit("cobrowse://stage-focus", json!({ "tabId": tab_id }));
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            harness_settings_get,
            harness_settings_set,
            site_policy_get,
            site_policy_set,
            page_identity,
            resolve_text_targets,
            scroll_to_target,
            margin_recall_targets,
            tab_tint_targets,
            tab_clear_tint,
            harness_bearer_set,
            harness_bearer_clear,
            local_node_status,
            commonplace_status,
            hosted_connection_status,
            model_status,
            receiver_settings_get,
            receiver_settings_set,
            receiver_status,
            tab_create,
            tab_navigate,
            tab_reload,
            tab_go_back,
            tab_go_forward,
            tab_close,
            tab_set_active,
            tab_set_bounds,
            tab_highlight,
            tab_clear_highlight,
            extract_visible_text,
            session_load,
            session_save,
            keychain_set,
            keychain_has,
            keychain_delete,
            harness_remember,
            harness_recall,
            model_chat,
            sync_run,
            background_fetch_receipt,
            space_bind_room,
            room_context,
            room_post_message,
            job_submit,
            queue_status,
            agent_tab_ingest,
            connector_proof_run
        ])
        .run(context)
        .expect("error while running CommonPlace desktop");
}
