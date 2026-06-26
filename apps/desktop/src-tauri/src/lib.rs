use std::collections::{BTreeMap, HashMap};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use serde_json::json;

const LOCAL_NODE_PORT: u16 = 17888;
const COMMONPLACE_NODE_PORT: u16 = 17890;
const HOSTED_ENDPOINT: &str = "https://rustyredcore-theorem-production.up.railway.app/mcp";

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct HarnessSettings {
    endpoint: String,
    local_endpoint: String,
    active_target: String,
    tenant: String,
    bearer_present: bool,
}

impl Default for HarnessSettings {
    fn default() -> Self {
        Self {
            endpoint: HOSTED_ENDPOINT.to_string(),
            local_endpoint: format!("http://127.0.0.1:{LOCAL_NODE_PORT}/mcp"),
            active_target: "hosted".to_string(),
            tenant: "Travis-Gilbert".to_string(),
            bearer_present: false,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReceiverSettings {
    enabled: bool,
    claim_interval_secs: u64,
    worktrees: BTreeMap<String, String>,
}

impl Default for ReceiverSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            claim_interval_secs: 15,
            worktrees: BTreeMap::new(),
        }
    }
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

#[derive(Clone, Debug, Deserialize)]
struct ModelChatInput {
    model: String,
    messages: Vec<ModelMessage>,
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
    merged_nodes: Option<u64>,
    merged_edges: Option<u64>,
    conflicts: Option<u64>,
    message: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
struct PageContext {
    url: String,
    title: String,
    text: String,
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
struct AgentIngestionReceipt {
    id: String,
    status: String,
    url: String,
    title: Option<String>,
    message: String,
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
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RoomRecordItem {
    id: String,
    kind: String,
    actor: Option<String>,
    title: Option<String>,
    summary: String,
    refs: Vec<String>,
    created_at: Option<String>,
}

#[derive(Default)]
struct DesktopState {
    harness: HarnessSettings,
    receiver: ReceiverSettings,
    keys: HashMap<String, bool>,
    tabs: HashMap<String, PageContext>,
    room_feed: HashMap<String, Vec<RoomFeedItem>>,
}

fn now_id(prefix: &str) -> String {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("{prefix}-{millis}")
}

fn support_dir(label: &str) -> String {
    format!("~/Library/Application Support/CommonPlace/{label}")
}

#[tauri::command]
fn receiver_settings_get(
    state: tauri::State<'_, Mutex<DesktopState>>,
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
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    state.lock().map_err(|error| error.to_string())?.receiver = settings;
    Ok(())
}

#[tauri::command]
fn receiver_status(state: tauri::State<'_, Mutex<DesktopState>>) -> Result<ReceiverStatus, String> {
    let receiver = state
        .lock()
        .map_err(|error| error.to_string())?
        .receiver
        .clone();
    Ok(ReceiverStatus {
        enabled: receiver.enabled,
        state: if receiver.enabled {
            "configured"
        } else {
            "off"
        }
        .to_string(),
        lanes: receiver.worktrees.keys().cloned().collect(),
        last_claim_time: None,
        last_job_result: Some(
            "Receiver runtime is not embedded in the CommonPlace repo yet.".to_string(),
        ),
    })
}

#[tauri::command]
fn room_context(
    room_id: String,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<RoomContext, String> {
    let state = state.lock().map_err(|error| error.to_string())?;
    Ok(RoomContext {
        feed: state.room_feed.get(&room_id).cloned().unwrap_or_default(),
        participants: vec![RoomParticipant {
            actor: "CommonPlace".to_string(),
            status: "local shell".to_string(),
            last_seen: None,
        }],
        intents: Vec::new(),
        records: Vec::new(),
    })
}

#[tauri::command]
fn room_post_message(
    input: RoomPostInput,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    let mut state = state.lock().map_err(|error| error.to_string())?;
    state
        .room_feed
        .entry(input.room_id)
        .or_default()
        .push(RoomFeedItem {
            id: now_id("room"),
            actor: "you".to_string(),
            text: input.message,
            created_at: None,
            kind: Some("message".to_string()),
        });
    Ok(())
}

#[tauri::command]
fn tab_create(
    tab_id: String,
    url: Option<String>,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    let page_url = url.unwrap_or_else(|| "about:blank".to_string());
    state
        .lock()
        .map_err(|error| error.to_string())?
        .tabs
        .insert(
            tab_id,
            PageContext {
                title: page_url.clone(),
                url: page_url,
                text: String::new(),
            },
        );
    Ok(())
}

#[tauri::command]
fn tab_navigate(
    tab_id: String,
    url: String,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    state
        .lock()
        .map_err(|error| error.to_string())?
        .tabs
        .insert(
            tab_id,
            PageContext {
                title: url.clone(),
                url,
                text: String::new(),
            },
        );
    Ok(())
}

#[tauri::command]
fn tab_set_active(_tab_id: Option<String>) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn extract_visible_text(
    tab_id: String,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<PageContext, String> {
    Ok(state
        .lock()
        .map_err(|error| error.to_string())?
        .tabs
        .get(&tab_id)
        .cloned()
        .unwrap_or(PageContext {
            url: "about:blank".to_string(),
            title: "Blank page".to_string(),
            text: String::new(),
        }))
}

#[tauri::command]
fn agent_tab_ingest(input: AgentTabIngestInput) -> Result<AgentIngestionReceipt, String> {
    Ok(AgentIngestionReceipt {
        id: now_id("ingest"),
        status: "deferred".to_string(),
        url: input.url,
        title: input.title,
        message: format!(
            "Captured {} characters from tab {}; RustyRed ingestion is wired through the CommonPlace API contract next.",
            input.text.len(),
            input.tab_id
        ),
    })
}

#[tauri::command]
fn local_node_status(
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<LocalNodeStatus, String> {
    let harness = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    Ok(LocalNodeStatus {
        node_up: false,
        endpoint: harness.local_endpoint,
        port: LOCAL_NODE_PORT,
        store_path: support_dir("rustyred-node"),
        active_target: harness.active_target,
        tools_match_hosted: false,
    })
}

#[tauri::command]
fn commonplace_status() -> Result<CommonplaceStatus, String> {
    Ok(CommonplaceStatus {
        node_up: false,
        endpoint: format!("http://127.0.0.1:{COMMONPLACE_NODE_PORT}"),
        port: COMMONPLACE_NODE_PORT,
        store_path: support_dir("commonplace-api"),
    })
}

#[tauri::command]
fn hosted_connection_status(
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<HostedConnectionStatus, String> {
    let harness = state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone();
    Ok(HostedConnectionStatus {
        endpoint: harness.endpoint,
        tenant: harness.tenant,
        bearer_present: harness.bearer_present,
        reachable: false,
        document_count: None,
        message: "Hosted status checks are not embedded in this migrated shell yet.".to_string(),
    })
}

#[tauri::command]
fn model_status() -> Result<ModelStatus, String> {
    Ok(ModelStatus {
        enabled: false,
        endpoint: "local".to_string(),
        model: "none".to_string(),
        reachable: false,
        message: "Model runtime is not embedded in the CommonPlace desktop shell yet.".to_string(),
    })
}

#[tauri::command]
fn model_chat(input: ModelChatInput) -> Result<ModelChatResult, String> {
    let last = input
        .messages
        .iter()
        .rev()
        .find(|message| message.role == "user")
        .map(|message| message.content.as_str())
        .unwrap_or("");
    let tokens_in = input
        .messages
        .iter()
        .map(|message| message.content.len() as u64)
        .sum::<u64>()
        / 4;
    Ok(ModelChatResult {
        content: format!(
            "[local shell] {last}\n\nThe migrated desktop app is running, but the model provider is not embedded here yet."
        ),
        usage: TurnUsage {
            provider: input.model.clone(),
            model: input.model,
            tokens_in,
            tokens_out: 24,
            estimated_usd: 0.0,
        },
    })
}

#[tauri::command]
fn harness_settings_get(
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<HarnessSettings, String> {
    Ok(state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .clone())
}

#[tauri::command]
fn harness_settings_set(
    settings: HarnessSettings,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    state.lock().map_err(|error| error.to_string())?.harness = settings;
    Ok(())
}

#[tauri::command]
fn harness_bearer_set(
    _token: String,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .bearer_present = true;
    Ok(())
}

#[tauri::command]
fn harness_bearer_clear(state: tauri::State<'_, Mutex<DesktopState>>) -> Result<(), String> {
    state
        .lock()
        .map_err(|error| error.to_string())?
        .harness
        .bearer_present = false;
    Ok(())
}

#[tauri::command]
fn keychain_set(
    provider: String,
    _key: String,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    state
        .lock()
        .map_err(|error| error.to_string())?
        .keys
        .insert(provider, true);
    Ok(())
}

#[tauri::command]
fn keychain_has(
    provider: String,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<bool, String> {
    Ok(state
        .lock()
        .map_err(|error| error.to_string())?
        .keys
        .get(&provider)
        .copied()
        .unwrap_or(false))
}

#[tauri::command]
fn keychain_delete(
    provider: String,
    state: tauri::State<'_, Mutex<DesktopState>>,
) -> Result<(), String> {
    state
        .lock()
        .map_err(|error| error.to_string())?
        .keys
        .remove(&provider);
    Ok(())
}

#[tauri::command]
fn sync_run() -> Result<SyncReceipt, String> {
    Ok(SyncReceipt {
        id: now_id("sync"),
        status: "deferred".to_string(),
        started_at: now_id("started"),
        finished_at: None,
        merged_nodes: None,
        merged_edges: None,
        conflicts: None,
        message: "Sync is waiting on the embedded RustyRed/CommonPlace API runtime.".to_string(),
    })
}

#[tauri::command]
fn shell_contract() -> serde_json::Value {
    json!({
        "app": "CommonPlace",
        "runtime": "tauri",
        "backend": "migrated-command-shim",
        "nativeRuntimeDeferred": [
            "embedded rustyred-thg local node",
            "theorem receiver dispatch loop",
            "durable commonplace-api spawn"
        ]
    })
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(DesktopState::default()))
        .invoke_handler(tauri::generate_handler![
            receiver_settings_get,
            receiver_settings_set,
            receiver_status,
            room_context,
            room_post_message,
            tab_create,
            tab_navigate,
            tab_set_active,
            extract_visible_text,
            agent_tab_ingest,
            local_node_status,
            commonplace_status,
            hosted_connection_status,
            model_status,
            model_chat,
            harness_settings_get,
            harness_settings_set,
            harness_bearer_set,
            harness_bearer_clear,
            keychain_set,
            keychain_has,
            keychain_delete,
            sync_run,
            shell_contract
        ])
        .run(tauri::generate_context!())
        .expect("error while running CommonPlace desktop");
}
