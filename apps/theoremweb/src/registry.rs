//! The canonical registry client seam.
//!
//! D03 sealed the backend registry as the single authority for `BodySpec` rows.
//! Nothing in this file declares a body kind, an icon, or a size. The client
//! view is exactly what the canonical document says, so `CommonPlace` cannot
//! become a second opinion the way `BodyRegistry::initial()` was.
//!
//! The seam is the document, not a trait. Parsing and catalog construction are
//! pure and tested here; fetching is a thin wasm-only call with no logic in it.

use std::fmt;

use serde::{Deserialize, Serialize};
use theoremweb_app::{SurfaceCatalog, SurfaceListResponse, SurfaceSpec};
use theoremweb_layout::{BodyRegistry, BodySpec};

/// The one contract version this client understands.
///
/// A document that names any other version is refused rather than partially
/// decoded, because a silently-tolerated version skew is how the two copies of
/// `theoremweb-surface-v1.json` drifted apart in the first place.
pub const CONTRACT_VERSION: &str = "theoremweb-surface-v1";

/// The versioned document the backend registry publishes.
#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct SurfaceContract {
    pub version: String,
    #[serde(default)]
    pub bodies: Vec<BodySpec>,
    #[serde(default)]
    pub surfaces: Vec<SurfaceSpec>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RegistryError {
    Decode(String),
    VersionMismatch { expected: &'static str, found: String },
    NoBodies,
    NoSurfaces,
    DuplicateBody(String),
    Transport(String),
}

impl fmt::Display for RegistryError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Decode(reason) => write!(formatter, "registry document is invalid: {reason}"),
            Self::VersionMismatch { expected, found } => write!(
                formatter,
                "registry document is version {found}, this host speaks {expected}"
            ),
            Self::NoBodies => formatter.write_str("registry document declares no bodies"),
            Self::NoSurfaces => formatter.write_str("registry document declares no surfaces"),
            Self::DuplicateBody(kind) => {
                write!(formatter, "registry document repeats body kind {kind}")
            }
            Self::Transport(reason) => write!(formatter, "registry fetch failed: {reason}"),
        }
    }
}

impl std::error::Error for RegistryError {}

impl SurfaceContract {
    /// Decode a canonical registry document.
    ///
    /// # Errors
    ///
    /// Returns [`RegistryError::Decode`] for malformed JSON and
    /// [`RegistryError::VersionMismatch`] when the document names a contract
    /// version this host does not speak.
    pub fn parse(bytes: &[u8]) -> Result<Self, RegistryError> {
        let contract: Self = serde_json::from_slice(bytes)
            .map_err(|error| RegistryError::Decode(error.to_string()))?;
        if contract.version != CONTRACT_VERSION {
            return Err(RegistryError::VersionMismatch {
                expected: CONTRACT_VERSION,
                found: contract.version,
            });
        }
        Ok(contract)
    }

    /// Build the client body registry from canonical rows only.
    ///
    /// # Errors
    ///
    /// Returns [`RegistryError::NoBodies`] for an empty body list and
    /// [`RegistryError::DuplicateBody`] when the document repeats a kind.
    pub fn body_registry(&self) -> Result<BodyRegistry, RegistryError> {
        if self.bodies.is_empty() {
            return Err(RegistryError::NoBodies);
        }
        BodyRegistry::from_canonical(self.bodies.iter().cloned())
            .map_err(|error| RegistryError::DuplicateBody(error.to_string()))
    }

    /// Build the surface catalog that resolves omnibox intents.
    ///
    /// # Errors
    ///
    /// Returns [`RegistryError::NoSurfaces`] when the document carries no rows,
    /// because an empty catalog would make every intent look like a typo.
    pub fn surface_catalog(&self) -> Result<SurfaceCatalog, RegistryError> {
        if self.surfaces.is_empty() {
            return Err(RegistryError::NoSurfaces);
        }
        Ok(SurfaceCatalog::from_live(SurfaceListResponse {
            count: self.surfaces.len(),
            surfaces: self.surfaces.clone(),
        }))
    }

    /// Rows whose renderer variant this build does not know.
    ///
    /// W01 blueprint step 5: an unrecognised variant is labeled and kept, never
    /// dropped and never a panic. A future backend renderer must leave the row
    /// visible so the tenant can see that it exists.
    #[must_use]
    pub fn unavailable_labels(&self) -> Vec<(String, String)> {
        self.surfaces
            .iter()
            .filter_map(|surface| {
                surface
                    .renderer
                    .unavailable_label()
                    .map(|label| (surface.surface_id.clone(), label))
            })
            .collect()
    }
}

/// Fetch the canonical registry document from the graph gateway.
///
/// Deliberately logic-free: everything worth testing lives in [`SurfaceContract`].
///
/// # Errors
///
/// Returns [`RegistryError::Transport`] when the request or body read fails.
#[cfg(target_arch = "wasm32")]
pub async fn fetch(base_url: &str) -> Result<SurfaceContract, RegistryError> {
    let response = gloo_net::http::Request::get(&format!("{base_url}/contract"))
        .send()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    let bytes = response
        .binary()
        .await
        .map_err(|error| RegistryError::Transport(error.to_string()))?;
    SurfaceContract::parse(&bytes)
}
