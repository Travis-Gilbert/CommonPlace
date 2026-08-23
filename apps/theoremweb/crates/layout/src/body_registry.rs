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
    #[must_use]
    pub fn initial() -> Self {
        let specs = [
            ("fields", "Fields", "list", 480, 320),
            ("related_records", "Related records", "link", 480, 280),
            ("record_table", "Record table", "table", 640, 360),
            ("thread", "Thread", "message", 480, 480),
            ("document", "Document", "file", 560, 640),
            ("chart", "Chart", "chart", 480, 320),
            ("timeline", "Timeline", "clock", 480, 400),
            ("iframe", "Iframe", "globe", 640, 480),
            ("sub_canvas", "Sub-canvas", "nodes", 640, 480),
            ("log", "Log", "terminal", 640, 320),
        ]
        .into_iter()
        .map(|(kind, title, icon, width, height)| {
            (
                kind.to_owned(),
                BodySpec {
                    kind: kind.into(),
                    title: title.into(),
                    icon: icon.into(),
                    renderer_binding: format!("theorem.body.{kind}"),
                    size: SizeNegotiation {
                        min_width: width / 2,
                        min_height: height / 2,
                        default_width: width,
                        default_height: height,
                        max_width: None,
                        max_height: None,
                    },
                },
            )
        })
        .collect();
        Self { specs }
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
mod tests {
    use super::*;

    #[test]
    fn one_registration_drives_both_palettes() {
        let registry = BodyRegistry::initial();
        assert_eq!(registry.widget_palette(), registry.node_palette());
        assert!(registry.get("record_table").is_some());
        assert!(registry.get("thread").is_some());
        assert_eq!(registry.widget_palette().len(), 10);
    }

    #[test]
    fn duplicate_registration_names_the_kind() {
        let mut registry = BodyRegistry::initial();
        let error = registry
            .register(registry.get("thread").unwrap().clone())
            .unwrap_err();
        assert_eq!(error.to_string(), "body kind already registered: thread");
    }
}
