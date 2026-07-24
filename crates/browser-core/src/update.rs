//! Update check against a cargo-dist style feed. Never auto-applies.

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdateFeed {
    pub app_name: String,
    pub releases: Vec<UpdateRelease>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UpdateRelease {
    pub version: String,
    pub url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateCheckResult {
    pub current: String,
    pub newer: Option<UpdateRelease>,
    /// Always false: BrowserCore never auto-applies.
    pub auto_applied: bool,
}

#[derive(Debug, Error)]
pub enum UpdateError {
    #[error("parse: {0}")]
    Parse(#[from] serde_json::Error),
}

pub fn check_update_feed(
    feed_json: &str,
    current_version: &str,
) -> Result<UpdateCheckResult, UpdateError> {
    let feed: UpdateFeed = serde_json::from_str(feed_json)?;
    let newer = feed
        .releases
        .into_iter()
        .find(|r| version_gt(&r.version, current_version));
    Ok(UpdateCheckResult {
        current: current_version.to_string(),
        newer,
        auto_applied: false,
    })
}

fn version_gt(a: &str, b: &str) -> bool {
    let pa = parse_semver(a);
    let pb = parse_semver(b);
    pa > pb
}

fn parse_semver(v: &str) -> (u64, u64, u64) {
    let mut parts = v.trim_start_matches('v').split('.');
    let major = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let minor = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let patch = parts.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    (major, minor, patch)
}
