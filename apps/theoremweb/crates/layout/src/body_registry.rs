//! The client body registry.
//!
//! D03 sealed `theorem-body-registry` in the Theorem repository as the single
//! authority for body declarations. This module therefore declares no kinds,
//! no icons, and no sizes. It is a container the host fills from the canonical
//! document.
//!
//! It used to carry a `BodyRegistry::initial()` with its own hardcoded list of
//! ten kinds. That list disagreed with the canonical crate on six of ten icons
//! and on all ten sizes, and it disagreed with the canonical wire fixture as
//! well, so the same body had three different answers depending on which
//! artifact you read. Removing the list is what collapses those three back to
//! one.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct SizeNegotiation {
    pub min_width: u32,
    pub min_height: u32,
    pub default_width: u32,
    pub default_height: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_width: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub max_height: Option<u32>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
pub struct BodySpec {
    pub kind: String,
    pub title: String,
    pub icon: String,
    pub renderer_binding: String,
    pub size: SizeNegotiation,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PaletteEntry {
    pub kind: String,
    pub title: String,
    pub icon: String,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct BodyRegistry {
    specs: BTreeMap<String, BodySpec>,
}

impl BodyRegistry {
    /// Build the registry from canonical rows.
    ///
    /// This is the only constructor that admits bodies. There is deliberately
    /// no default and no `initial()`: a client that can produce body kinds
    /// without the backend is a second authority.
    ///
    /// # Errors
    ///
    /// Returns [`RegistryError::EmptyKind`] for a blank kind or
    /// [`RegistryError::DuplicateKind`] when the canonical document repeats a
    /// kind. A repeat is refused rather than last-write-wins, because silently
    /// collapsing it would hide exactly the drift this registry exists to stop.
    pub fn from_canonical(
        specs: impl IntoIterator<Item = BodySpec>,
    ) -> Result<Self, RegistryError> {
        let mut registry = Self::default();
        for spec in specs {
            registry.register(spec)?;
        }
        Ok(registry)
    }

    /// Register one body declaration.
    ///
    /// # Errors
    ///
    /// Returns [`RegistryError::EmptyKind`] for a blank kind or
    /// [`RegistryError::DuplicateKind`] when the kind already exists.
    pub fn register(&mut self, spec: BodySpec) -> Result<(), RegistryError> {
        if spec.kind.trim().is_empty() {
            return Err(RegistryError::EmptyKind);
        }
        if self.specs.contains_key(&spec.kind) {
            return Err(RegistryError::DuplicateKind(spec.kind));
        }
        self.specs.insert(spec.kind.clone(), spec);
        Ok(())
    }

    #[must_use]
    pub fn get(&self, kind: &str) -> Option<&BodySpec> {
        self.specs.get(kind)
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.specs.len()
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        self.specs.is_empty()
    }

    #[must_use]
    pub fn kinds(&self) -> Vec<&str> {
        self.specs.keys().map(String::as_str).collect()
    }

    #[must_use]
    pub fn widget_palette(&self) -> Vec<PaletteEntry> {
        self.palette()
    }

    #[must_use]
    pub fn node_palette(&self) -> Vec<PaletteEntry> {
        self.palette()
    }

    fn palette(&self) -> Vec<PaletteEntry> {
        self.specs
            .values()
            .map(|spec| PaletteEntry {
                kind: spec.kind.clone(),
                title: spec.title.clone(),
                icon: spec.icon.clone(),
            })
            .collect()
    }
}

#[derive(Clone, Debug, Eq, Error, PartialEq)]
pub enum RegistryError {
    #[error("body kind must not be empty")]
    EmptyKind,
    #[error("body kind already registered: {0}")]
    DuplicateKind(String),
}

#[cfg(test)]
pub mod fixtures {
    use super::{BodyRegistry, BodySpec, SizeNegotiation};

    /// A stand-in for the canonical document, for crate-local tests only.
    ///
    /// These values are not authority. A test that needs real numbers must read
    /// the canonical contract instead.
    pub fn canonical_stub() -> BodyRegistry {
        BodyRegistry::from_canonical(
            ["fields", "related_records", "record_table", "thread"]
                .into_iter()
                .map(|kind| BodySpec {
                    kind: kind.to_owned(),
                    title: kind.to_owned(),
                    icon: kind.to_owned(),
                    renderer_binding: format!("theorem.body.{kind}"),
                    size: SizeNegotiation {
                        min_width: 240,
                        min_height: 160,
                        default_width: 480,
                        default_height: 320,
                        max_width: None,
                        max_height: None,
                    },
                }),
        )
        .expect("stub kinds are distinct and non-empty")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_registration_drives_both_palettes() {
        let registry = fixtures::canonical_stub();
        assert_eq!(registry.widget_palette(), registry.node_palette());
        assert!(registry.get("record_table").is_some());
        assert!(registry.get("thread").is_some());
    }

    #[test]
    fn the_registry_declares_nothing_on_its_own() {
        let registry = BodyRegistry::default();
        assert!(registry.is_empty());
        assert!(registry.get("record_table").is_none());
    }

    #[test]
    fn a_repeated_canonical_kind_is_refused_by_name() {
        let registry = fixtures::canonical_stub();
        let repeated = registry.get("thread").expect("stub has thread").clone();
        let error = BodyRegistry::from_canonical(
            registry.specs.values().cloned().chain([repeated]),
        )
        .unwrap_err();
        assert_eq!(error.to_string(), "body kind already registered: thread");
    }

    #[test]
    fn a_blank_kind_is_refused() {
        let mut blank = fixtures::canonical_stub()
            .get("thread")
            .expect("stub has thread")
            .clone();
        blank.kind = "   ".into();
        assert_eq!(
            BodyRegistry::from_canonical([blank]).unwrap_err(),
            RegistryError::EmptyKind
        );
    }
}
