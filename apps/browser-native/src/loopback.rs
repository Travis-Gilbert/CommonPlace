//! Authenticated typed loopback transport for the CommonPlace React surface.
//!
//! The native process owns this state. Reloading or replacing the Wry webview
//! creates a new connection and subscription, but does not replace the state.

use std::collections::{BTreeMap, HashMap};
use std::io::ErrorKind;
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tungstenite::handshake::server::{
    ErrorResponse as HandshakeErrorResponse, Request as HandshakeRequest,
    Response as HandshakeResponse,
};
use tungstenite::http::StatusCode;
use tungstenite::{accept_hdr, Error as WebSocketError, Message, WebSocket};
use uuid::Uuid;

pub const BRIDGE_VERSION: u8 = 1;
const ACCEPT_POLL: Duration = Duration::from_millis(10);
const CLIENT_POLL: Duration = Duration::from_millis(25);
const HANDSHAKE_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeBootstrap {
    pub version: u8,
    pub endpoint: String,
    pub token: String,
}

impl BridgeBootstrap {
    /// JavaScript injected before the console bundle executes.
    pub fn initialization_script(&self) -> Result<String, serde_json::Error> {
        Ok(format!(
            "Object.defineProperty(window, '__COMMONPLACE_NATIVE__', {{ value: {}, writable: false, configurable: false }});",
            serde_json::to_string(self)?
        ))
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeBlock {
    pub id: String,
    pub workspace_id: String,
    pub kind: String,
    #[serde(default = "empty_object")]
    pub attrs: Value,
    #[serde(default)]
    pub grants: Vec<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeLayout {
    pub workspace_id: String,
    pub tree: Value,
    pub revised_at: String,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct NativeContribution {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pane_kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub composer_verb: Option<String>,
    pub label: String,
}

#[derive(Debug)]
pub struct NativeHostState {
    pub blocks: BTreeMap<String, NativeBlock>,
    pub layouts: BTreeMap<String, NativeLayout>,
    pub contributions: Vec<NativeContribution>,
    pub open_targets: Vec<Value>,
}

impl Default for NativeHostState {
    fn default() -> Self {
        Self {
            blocks: BTreeMap::new(),
            layouts: BTreeMap::new(),
            contributions: vec![
                NativeContribution {
                    id: "pane.note".into(),
                    pane_kind: Some("note".into()),
                    composer_verb: None,
                    label: "Note".into(),
                },
                NativeContribution {
                    id: "pane.browser".into(),
                    pane_kind: Some("browser".into()),
                    composer_verb: None,
                    label: "Browser".into(),
                },
            ],
            open_targets: Vec::new(),
        }
    }
}

#[derive(Clone, Debug, Deserialize)]
struct WireRequest {
    version: u8,
    id: String,
    token: String,
    method: String,
    #[serde(default)]
    params: Value,
}

#[derive(Debug, Serialize)]
struct WireResponse {
    version: u8,
    id: String,
    ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<WireError>,
}

#[derive(Debug, Serialize)]
struct WireError {
    code: &'static str,
    message: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct WireWorkspaceEvent {
    version: u8,
    event: &'static str,
    subscription_id: String,
    workspace_id: String,
    payload: Value,
}

#[derive(Clone)]
struct Subscription {
    workspace_id: String,
    subscription_id: String,
    sender: Sender<WireWorkspaceEvent>,
}

#[derive(Default)]
struct EventHub {
    by_connection: Mutex<HashMap<u64, Vec<Subscription>>>,
}

impl EventHub {
    fn subscribe(
        &self,
        connection_id: u64,
        workspace_id: String,
        subscription_id: String,
        sender: Sender<WireWorkspaceEvent>,
    ) {
        let mut connections = self.by_connection.lock().unwrap();
        let subscriptions = connections.entry(connection_id).or_default();
        subscriptions.retain(|item| item.subscription_id != subscription_id);
        subscriptions.push(Subscription {
            workspace_id,
            subscription_id,
            sender,
        });
    }

    fn unsubscribe(&self, connection_id: u64, subscription_id: &str) {
        let mut connections = self.by_connection.lock().unwrap();
        if let Some(subscriptions) = connections.get_mut(&connection_id) {
            subscriptions.retain(|item| item.subscription_id != subscription_id);
            if subscriptions.is_empty() {
                connections.remove(&connection_id);
            }
        }
    }

    fn remove_connection(&self, connection_id: u64) {
        self.by_connection.lock().unwrap().remove(&connection_id);
    }

    fn publish(&self, workspace_id: &str, payload: Value) {
        let mut connections = self.by_connection.lock().unwrap();
        for subscriptions in connections.values_mut() {
            subscriptions.retain(|subscription| {
                if subscription.workspace_id != workspace_id {
                    return true;
                }
                subscription
                    .sender
                    .send(WireWorkspaceEvent {
                        version: BRIDGE_VERSION,
                        event: "workspace",
                        subscription_id: subscription.subscription_id.clone(),
                        workspace_id: workspace_id.to_string(),
                        payload: payload.clone(),
                    })
                    .is_ok()
            });
        }
    }
}

/// Process-owned server. Dropping it stops accepting and closes clients on
/// their next short read timeout.
pub struct LoopbackBridge {
    bootstrap: BridgeBootstrap,
    address: SocketAddr,
    state: Arc<Mutex<NativeHostState>>,
    stopping: Arc<AtomicBool>,
    accept_thread: Option<JoinHandle<()>>,
}

impl LoopbackBridge {
    pub fn start(allowed_origin: Option<String>) -> Result<Self, String> {
        let listener = TcpListener::bind("127.0.0.1:0")
            .map_err(|error| format!("could not bind native host bridge: {error}"))?;
        listener
            .set_nonblocking(true)
            .map_err(|error| format!("could not configure native host bridge: {error}"))?;
        let address = listener
            .local_addr()
            .map_err(|error| format!("could not read native host address: {error}"))?;
        let token = Uuid::new_v4().simple().to_string();
        let bootstrap = BridgeBootstrap {
            version: BRIDGE_VERSION,
            endpoint: format!("ws://{address}/host"),
            token: token.clone(),
        };
        let state = Arc::new(Mutex::new(NativeHostState::default()));
        let stopping = Arc::new(AtomicBool::new(false));
        let hub = Arc::new(EventHub::default());
        let next_connection = Arc::new(AtomicU64::new(1));

        let server_state = Arc::clone(&state);
        let server_stopping = Arc::clone(&stopping);
        let accept_thread = thread::spawn(move || {
            while !server_stopping.load(Ordering::SeqCst) {
                match listener.accept() {
                    Ok((stream, _)) => {
                        let id = next_connection.fetch_add(1, Ordering::SeqCst);
                        let client_state = Arc::clone(&server_state);
                        let client_hub = Arc::clone(&hub);
                        let client_stopping = Arc::clone(&server_stopping);
                        let client_token = token.clone();
                        let client_origin = allowed_origin.clone();
                        thread::spawn(move || {
                            serve_client(
                                id,
                                stream,
                                client_token,
                                client_origin,
                                client_state,
                                client_hub,
                                client_stopping,
                            );
                        });
                    }
                    Err(error) if error.kind() == ErrorKind::WouldBlock => {
                        thread::sleep(ACCEPT_POLL);
                    }
                    Err(_) => break,
                }
            }
        });

        Ok(Self {
            bootstrap,
            address,
            state,
            stopping,
            accept_thread: Some(accept_thread),
        })
    }

    pub fn bootstrap(&self) -> &BridgeBootstrap {
        &self.bootstrap
    }

    pub fn state(&self) -> Arc<Mutex<NativeHostState>> {
        Arc::clone(&self.state)
    }
}

impl Drop for LoopbackBridge {
    fn drop(&mut self) {
        self.stopping.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect_timeout(&self.address, ACCEPT_POLL);
        if let Some(thread) = self.accept_thread.take() {
            let _ = thread.join();
        }
    }
}

// tungstenite fixes this callback's error type to an HTTP response. Keeping the
// full rejection response is useful at the trust boundary and cannot be boxed
// without changing the callback contract.
#[allow(clippy::result_large_err)]
fn serve_client(
    connection_id: u64,
    stream: TcpStream,
    token: String,
    allowed_origin: Option<String>,
    state: Arc<Mutex<NativeHostState>>,
    hub: Arc<EventHub>,
    stopping: Arc<AtomicBool>,
) {
    let _ = stream.set_read_timeout(Some(HANDSHAKE_TIMEOUT));
    let _ = stream.set_write_timeout(Some(HANDSHAKE_TIMEOUT));
    let callback = move |request: &HandshakeRequest, response: HandshakeResponse| {
        if request.uri().path() != "/host" {
            return Err(forbidden("unknown native bridge path"));
        }
        if let Some(expected) = allowed_origin.as_deref() {
            let actual = request
                .headers()
                .get("origin")
                .and_then(|value| value.to_str().ok());
            if actual != Some(expected) {
                return Err(forbidden("origin is not trusted by the native shell"));
            }
        }
        Ok(response)
    };
    let Ok(mut socket) = accept_hdr(stream, callback) else {
        return;
    };
    let _ = socket.get_mut().set_read_timeout(Some(CLIENT_POLL));
    let _ = socket.get_mut().set_write_timeout(Some(HANDSHAKE_TIMEOUT));
    let (event_sender, event_receiver) = channel();

    while !stopping.load(Ordering::SeqCst) {
        if drain_events(&mut socket, &event_receiver).is_err() {
            break;
        }
        match socket.read() {
            Ok(Message::Text(text)) => {
                if process_message(
                    connection_id,
                    &mut socket,
                    &text,
                    &token,
                    &state,
                    &hub,
                    &event_sender,
                )
                .is_err()
                {
                    break;
                }
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => {}
            Err(WebSocketError::Io(error))
                if matches!(error.kind(), ErrorKind::WouldBlock | ErrorKind::TimedOut) => {}
            Err(WebSocketError::ConnectionClosed | WebSocketError::AlreadyClosed) => break,
            Err(_) => break,
        }
    }
    hub.remove_connection(connection_id);
    let _ = socket.close(None);
}

fn forbidden(message: &str) -> HandshakeErrorResponse {
    HandshakeResponse::builder()
        .status(StatusCode::FORBIDDEN)
        .body(Some(message.to_string()))
        .expect("static forbidden response is valid")
}

fn process_message(
    connection_id: u64,
    socket: &mut WebSocket<TcpStream>,
    raw: &str,
    token: &str,
    state: &Arc<Mutex<NativeHostState>>,
    hub: &Arc<EventHub>,
    event_sender: &Sender<WireWorkspaceEvent>,
) -> Result<(), WebSocketError> {
    let request = match serde_json::from_str::<WireRequest>(raw) {
        Ok(request) => request,
        Err(error) => {
            return send_response(
                socket,
                WireResponse::error("unknown", "invalid_request", error.to_string()),
            );
        }
    };
    let id = request.id.clone();
    if request.version != BRIDGE_VERSION {
        return send_response(
            socket,
            WireResponse::error(id, "unsupported_version", "bridge version mismatch"),
        );
    }
    if request.token != token {
        return send_response(
            socket,
            WireResponse::error(id, "unauthorized", "native bridge token rejected"),
        );
    }

    match handle_request(connection_id, request, state, hub, event_sender) {
        Ok(outcome) => {
            send_response(socket, WireResponse::success(id, outcome.result))?;
            for payload in outcome.direct_events {
                send_json(socket, &payload)?;
            }
            if let Some((workspace_id, payload)) = outcome.broadcast {
                hub.publish(&workspace_id, payload);
            }
            Ok(())
        }
        Err(error) => send_response(socket, WireResponse::error(id, error.code, error.message)),
    }
}

struct RequestOutcome {
    result: Value,
    direct_events: Vec<WireWorkspaceEvent>,
    broadcast: Option<(String, Value)>,
}

impl RequestOutcome {
    fn result(result: Value) -> Self {
        Self {
            result,
            direct_events: Vec::new(),
            broadcast: None,
        }
    }

    fn broadcast(result: Value, workspace_id: String, payload: Value) -> Self {
        Self {
            result,
            direct_events: Vec::new(),
            broadcast: Some((workspace_id, payload)),
        }
    }
}

struct RequestError {
    code: &'static str,
    message: String,
}

fn handle_request(
    connection_id: u64,
    request: WireRequest,
    state: &Arc<Mutex<NativeHostState>>,
    hub: &Arc<EventHub>,
    event_sender: &Sender<WireWorkspaceEvent>,
) -> Result<RequestOutcome, RequestError> {
    match request.method.as_str() {
        "queryObjects" => query_objects(&request.params, state),
        "invokeCapability" => invoke_capability(&request.params, state),
        "subscribeWorkspace" => {
            let params: SubscribeParams = decode(request.params)?;
            hub.subscribe(
                connection_id,
                params.workspace_id.clone(),
                params.subscription_id.clone(),
                event_sender.clone(),
            );
            let direct_events = replay_events(
                &state.lock().unwrap(),
                &params.workspace_id,
                &params.subscription_id,
            );
            Ok(RequestOutcome {
                result: Value::Null,
                direct_events,
                broadcast: None,
            })
        }
        "unsubscribeWorkspace" => {
            let params: UnsubscribeParams = decode(request.params)?;
            hub.unsubscribe(connection_id, &params.subscription_id);
            Ok(RequestOutcome::result(Value::Null))
        }
        "placeBlock" => place_block(request.params, state),
        "persistLayout" => persist_layout(request.params, state),
        "openTarget" => {
            let params: OpenTargetParams = decode(request.params)?;
            state.lock().unwrap().open_targets.push(params.t);
            Ok(RequestOutcome::result(Value::Null))
        }
        "publishPresence" => publish_event(request.params, "presence"),
        "publishLens" => publish_event(request.params, "lens"),
        _ => Err(RequestError {
            code: "unknown_method",
            message: format!("unknown native host method {}", request.method),
        }),
    }
}

fn query_objects(
    params: &Value,
    state: &Arc<Mutex<NativeHostState>>,
) -> Result<RequestOutcome, RequestError> {
    let params: QueryParams = decode(params.clone())?;
    let state = state.lock().unwrap();
    let mut objects: Vec<Value> = state
        .blocks
        .values()
        .filter(|block| {
            params
                .q
                .ids
                .as_ref()
                .map(|ids| ids.contains(&block.id))
                .unwrap_or(true)
                && params
                    .q
                    .kinds
                    .as_ref()
                    .map(|kinds| kinds.contains(&block.kind))
                    .unwrap_or(true)
        })
        .filter_map(|block| {
            let title = block
                .attrs
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or(&block.kind);
            let object = json!({
                "id": block.id,
                "kind": block.kind,
                "title": title,
                "attrs": block.attrs,
            });
            let matches_text = params.q.text.as_ref().is_none_or(|text| {
                let needle = text.to_lowercase();
                title.to_lowercase().contains(&needle)
                    || block.kind.to_lowercase().contains(&needle)
            });
            matches_text.then_some(object)
        })
        .collect();
    let total = objects.len();
    if let Some(limit) = params.q.limit {
        objects.truncate(limit);
    }
    Ok(RequestOutcome::result(json!({
        "objects": objects,
        "total": total,
    })))
}

fn invoke_capability(
    params: &Value,
    state: &Arc<Mutex<NativeHostState>>,
) -> Result<RequestOutcome, RequestError> {
    let params: CapabilityParams = decode(params.clone())?;
    let payload = if params.r.capability == "list_extension_points" {
        json!({ "contributions": state.lock().unwrap().contributions })
    } else {
        params.r.args.unwrap_or_else(empty_object)
    };
    Ok(RequestOutcome::result(json!({
        "capability": params.r.capability,
        "ok": true,
        "detail": "native_loopback_ack",
        "payload": payload,
    })))
}

fn place_block(
    params: Value,
    state: &Arc<Mutex<NativeHostState>>,
) -> Result<RequestOutcome, RequestError> {
    let params: PlaceBlockParams = decode(params)?;
    let block = NativeBlock {
        id: params
            .r
            .id
            .unwrap_or_else(|| format!("block_{}", Uuid::new_v4().simple())),
        workspace_id: params.r.workspace_id,
        kind: params.r.kind,
        attrs: params.r.attrs.unwrap_or_else(empty_object),
        grants: params.r.grants.unwrap_or_default(),
    };
    state
        .lock()
        .unwrap()
        .blocks
        .insert(block.id.clone(), block.clone());
    let result = serde_json::to_value(&block).map_err(internal_error)?;
    Ok(RequestOutcome::broadcast(
        result,
        block.workspace_id.clone(),
        json!({ "type": "block_placed", "block": block }),
    ))
}

fn persist_layout(
    params: Value,
    state: &Arc<Mutex<NativeHostState>>,
) -> Result<RequestOutcome, RequestError> {
    let params: PersistLayoutParams = decode(params)?;
    let workspace_id = params.l.workspace_id.clone();
    state
        .lock()
        .unwrap()
        .layouts
        .insert(workspace_id.clone(), params.l.clone());
    Ok(RequestOutcome::broadcast(
        Value::Null,
        workspace_id,
        json!({ "type": "layout", "layout": params.l }),
    ))
}

fn publish_event(params: Value, field: &'static str) -> Result<RequestOutcome, RequestError> {
    let mut object = params.as_object().cloned().ok_or_else(|| RequestError {
        code: "invalid_params",
        message: "event params must be an object".into(),
    })?;
    let workspace_id = object
        .remove("workspaceId")
        .and_then(|value| value.as_str().map(str::to_string))
        .ok_or_else(|| RequestError {
            code: "invalid_params",
            message: "event workspaceId is required".into(),
        })?;
    let event = object.remove(field).ok_or_else(|| RequestError {
        code: "invalid_params",
        message: format!("event {field} is required"),
    })?;
    let mut payload = serde_json::Map::new();
    payload.insert("type".into(), Value::String(field.into()));
    payload.insert(field.into(), event);
    Ok(RequestOutcome::broadcast(
        Value::Null,
        workspace_id,
        Value::Object(payload),
    ))
}

fn replay_events(
    state: &NativeHostState,
    workspace_id: &str,
    subscription_id: &str,
) -> Vec<WireWorkspaceEvent> {
    let wrap = |payload| WireWorkspaceEvent {
        version: BRIDGE_VERSION,
        event: "workspace",
        subscription_id: subscription_id.to_string(),
        workspace_id: workspace_id.to_string(),
        payload,
    };
    let mut events = Vec::new();
    if let Some(layout) = state.layouts.get(workspace_id) {
        events.push(wrap(json!({ "type": "layout", "layout": layout })));
    }
    for block in state
        .blocks
        .values()
        .filter(|block| block.workspace_id == workspace_id)
    {
        events.push(wrap(json!({ "type": "block_placed", "block": block })));
    }
    events.push(wrap(json!({
        "type": "extension_points",
        "contributions": state.contributions,
    })));
    events
}

fn drain_events(
    socket: &mut WebSocket<TcpStream>,
    receiver: &Receiver<WireWorkspaceEvent>,
) -> Result<(), WebSocketError> {
    while let Ok(event) = receiver.try_recv() {
        send_json(socket, &event)?;
    }
    Ok(())
}

fn send_response(
    socket: &mut WebSocket<TcpStream>,
    response: WireResponse,
) -> Result<(), WebSocketError> {
    send_json(socket, &response)
}

fn send_json(
    socket: &mut WebSocket<TcpStream>,
    value: &impl Serialize,
) -> Result<(), WebSocketError> {
    let text = serde_json::to_string(value)
        .map_err(|error| WebSocketError::Io(std::io::Error::new(ErrorKind::InvalidData, error)))?;
    socket.send(Message::Text(text.into()))
}

impl WireResponse {
    fn success(id: String, result: Value) -> Self {
        Self {
            version: BRIDGE_VERSION,
            id,
            ok: true,
            result: Some(result),
            error: None,
        }
    }

    fn error(id: impl Into<String>, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            version: BRIDGE_VERSION,
            id: id.into(),
            ok: false,
            result: None,
            error: Some(WireError {
                code,
                message: message.into(),
            }),
        }
    }
}

fn decode<T: for<'de> Deserialize<'de>>(value: Value) -> Result<T, RequestError> {
    serde_json::from_value(value).map_err(|error| RequestError {
        code: "invalid_params",
        message: error.to_string(),
    })
}

fn internal_error(error: serde_json::Error) -> RequestError {
    RequestError {
        code: "internal_error",
        message: error.to_string(),
    }
}

fn empty_object() -> Value {
    Value::Object(serde_json::Map::new())
}

#[derive(Deserialize)]
struct SubscribeParams {
    #[serde(rename = "workspaceId")]
    workspace_id: String,
    #[serde(rename = "subscriptionId")]
    subscription_id: String,
}

#[derive(Deserialize)]
struct UnsubscribeParams {
    #[serde(rename = "subscriptionId")]
    subscription_id: String,
}

#[derive(Deserialize)]
struct QueryParams {
    q: NativeQuery,
}

#[derive(Deserialize)]
struct NativeQuery {
    text: Option<String>,
    kinds: Option<Vec<String>>,
    ids: Option<Vec<String>>,
    limit: Option<usize>,
}

#[derive(Deserialize)]
struct CapabilityParams {
    r: NativeCapability,
}

#[derive(Deserialize)]
struct NativeCapability {
    capability: String,
    args: Option<Value>,
}

#[derive(Deserialize)]
struct PlaceBlockParams {
    r: NativeBlockRequest,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct NativeBlockRequest {
    workspace_id: String,
    kind: String,
    id: Option<String>,
    attrs: Option<Value>,
    grants: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct PersistLayoutParams {
    l: NativeLayout,
}

#[derive(Deserialize)]
struct OpenTargetParams {
    t: Value,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tungstenite::client::IntoClientRequest;
    use tungstenite::connect;
    use tungstenite::http::HeaderValue;

    fn send(socket: &mut WebSocket<tungstenite::stream::MaybeTlsStream<TcpStream>>, value: Value) {
        socket
            .send(Message::Text(value.to_string().into()))
            .unwrap();
    }

    fn read(socket: &mut WebSocket<tungstenite::stream::MaybeTlsStream<TcpStream>>) -> Value {
        let message = socket.read().unwrap();
        serde_json::from_str(message.to_text().unwrap()).unwrap()
    }

    #[test]
    fn authenticated_place_block_survives_surface_reconnect() {
        let bridge = LoopbackBridge::start(None).unwrap();
        let bootstrap = bridge.bootstrap().clone();
        assert!(bootstrap.endpoint.starts_with("ws://127.0.0.1:"));
        assert!(!bootstrap
            .initialization_script()
            .unwrap()
            .contains("?token="));

        let (mut first, _) = connect(&bootstrap.endpoint).unwrap();
        send(
            &mut first,
            json!({
                "version": BRIDGE_VERSION,
                "id": "bad",
                "token": "wrong",
                "method": "queryObjects",
                "params": { "q": {} },
            }),
        );
        let unauthorized = read(&mut first);
        assert_eq!(unauthorized["error"]["code"], "unauthorized");

        send(
            &mut first,
            json!({
                "version": BRIDGE_VERSION,
                "id": "place",
                "token": bootstrap.token,
                "method": "placeBlock",
                "params": {
                    "r": {
                        "workspaceId": "fixture",
                        "kind": "note",
                        "id": "block_canonical",
                        "attrs": { "title": "Persisted" },
                        "grants": ["edit"]
                    }
                },
            }),
        );
        let placed = read(&mut first);
        assert_eq!(placed["result"]["id"], "block_canonical");
        first.close(None).unwrap();

        let (mut reloaded, _) = connect(&bootstrap.endpoint).unwrap();
        send(
            &mut reloaded,
            json!({
                "version": BRIDGE_VERSION,
                "id": "subscribe",
                "token": bootstrap.token,
                "method": "subscribeWorkspace",
                "params": {
                    "workspaceId": "fixture",
                    "subscriptionId": "after_reload"
                },
            }),
        );
        let subscribed = read(&mut reloaded);
        assert_eq!(subscribed["ok"], true);
        let replay = read(&mut reloaded);
        assert_eq!(replay["event"], "workspace");
        assert_eq!(replay["payload"]["block"]["id"], "block_canonical");

        let state = bridge.state();
        assert_eq!(
            state.lock().unwrap().blocks["block_canonical"].attrs["title"],
            "Persisted"
        );
    }

    #[test]
    fn handshake_requires_the_exact_console_origin() {
        let bridge = LoopbackBridge::start(Some("http://127.0.0.1:3010".into())).unwrap();
        let denied = connect(&bridge.bootstrap().endpoint);
        assert!(
            matches!(denied, Err(WebSocketError::Http(response)) if response.status() == StatusCode::FORBIDDEN)
        );

        let mut request = bridge
            .bootstrap()
            .endpoint
            .as_str()
            .into_client_request()
            .unwrap();
        request
            .headers_mut()
            .insert("origin", HeaderValue::from_static("http://127.0.0.1:3010"));
        let (mut accepted, _) = connect(request).unwrap();
        accepted.close(None).unwrap();
    }
}
