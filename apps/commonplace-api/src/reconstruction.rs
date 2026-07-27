//! The typed CommonPlace GraphQL bridge to Theorem's reconstruction executor.
//!
//! Reconstruction runs live in Theorem's tenant graph, not in CommonPlace's
//! object graph. This module therefore forwards a bounded GraphQL document
//! through Theorem's authenticated MCP transport rather than duplicating the
//! executor or materializing a second run store.

use std::env;
use std::time::Duration;

use serde_json::{json, Value};

const MCP_URL_ENV: &str = "THEOREM_RECONSTRUCTION_MCP_URL";
const MCP_TOKEN_ENV: &str = "THEOREM_RECONSTRUCTION_MCP_TOKEN";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);

/// Call Theorem's pinned GraphQL-over-MCP tools and return the GraphQL
/// `{ data, errors }` envelope carried in MCP structured content.
pub async fn execute(
    tenant: &str,
    tool: &str,
    query: &str,
    variables: Value,
) -> Result<Value, String> {
    let endpoint = configured_endpoint()?;
    let token = configured_token()?;
    let client = reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|error| format!("could not construct reconstruction MCP client: {error}"))?;
    let response = client
        .post(endpoint)
        .bearer_auth(token)
        .json(&json!({
            "jsonrpc": "2.0",
            "id": "commonplace-reconstruction",
            "method": "tools/call",
            "params": {
                "name": tool,
                "arguments": {
                    "tenant": tenant,
                    "query": query,
                    "variables": variables,
                }
            }
        }))
        .send()
        .await
        .map_err(|error| format!("reconstruction MCP request failed: {error}"))?;
    let status = response.status();
    let body = response
        .json::<Value>()
        .await
        .map_err(|error| format!("reconstruction MCP response was not JSON: {error}"))?;
    if !status.is_success() {
        return Err(format!("reconstruction MCP returned HTTP {status}"));
    }
    if let Some(error) = body.get("error") {
        return Err(format!("reconstruction MCP rejected the request: {error}"));
    }
    body.pointer("/result/structuredContent")
        .cloned()
        .ok_or_else(|| "reconstruction MCP response omitted structuredContent".to_string())
}

fn configured_endpoint() -> Result<String, String> {
    let endpoint = nonempty_env(MCP_URL_ENV).ok_or_else(|| {
        format!("reconstruction is unavailable: set {MCP_URL_ENV} to Theorem's /mcp endpoint")
    })?;
    if endpoint.starts_with("http://") || endpoint.starts_with("https://") {
        Ok(endpoint)
    } else {
        Err(format!("{MCP_URL_ENV} must be an HTTP(S) URL"))
    }
}

fn configured_token() -> Result<String, String> {
    nonempty_env(MCP_TOKEN_ENV).ok_or_else(|| {
        format!("reconstruction is unavailable: set {MCP_TOKEN_ENV} for Theorem MCP authentication")
    })
}

fn nonempty_env(key: &str) -> Option<String> {
    env::var(key)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}
