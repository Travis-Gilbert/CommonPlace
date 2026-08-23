//! The runnable TheoremWeb product host.
//!
//! Plan node W01. Before this package existed the seven surface crates were
//! seven separate workspace roots, and three of them (`layout`,
//! `canvas-gallery`, `agent-runtime`) were linked by nothing at all. This is
//! the composition root: it owns the binary, the canonical registry seam, and
//! the seven-row seed.

pub mod app;
pub mod registry;
pub mod seed;

pub use app::{HostModel, TheoremWebHost};
pub use registry::{RegistryError, SurfaceContract, CONTRACT_VERSION};
pub use seed::{initial_surfaces, missing_ids, plan_seed, SeedEndpoints};

use serde::Serialize;
use theoremweb_app::{SurfaceCatalog, SurfaceHistory};
use theoremweb_layout::BodyRegistry;

/// Everything the host resolves from one canonical document at boot.
pub struct Boot {
    pub catalog: SurfaceCatalog,
    pub bodies: BodyRegistry,
    pub history: SurfaceHistory,
    pub unavailable: Vec<(String, String)>,
}

/// A replayable statement of what the host resolved, for V01.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct BootReceipt {
    pub contract_version: String,
    pub surface_ids: Vec<String>,
    pub body_kinds: Vec<String>,
    pub missing_seed_ids: Vec<String>,
    pub unavailable_labels: Vec<String>,
    pub registry_source: &'static str,
    pub intents: Vec<ResolvedIntent>,
    pub history: Vec<ResolvedIntent>,
}

/// One omnibox intent as the host actually resolved it.
///
/// V01 asserts against these rather than against a JavaScript
/// reimplementation, so the oracle proves the product and not itself.
#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct ResolvedIntent {
    pub step: String,
    pub intent: String,
    pub surface_id: String,
    pub binding: theoremweb_app::ScopeBinding,
}

impl Boot {
    /// Resolve the host from a canonical registry document.
    ///
    /// # Errors
    ///
    /// Propagates every [`RegistryError`] from decoding, version checking, and
    /// catalog construction. The host refuses to boot on a bad document rather
    /// than falling back to a built-in list, because a built-in fallback is
    /// how a client becomes a second registry authority.
    pub fn resolve(contract: &SurfaceContract) -> Result<Self, RegistryError> {
        Ok(Self {
            catalog: contract.surface_catalog()?,
            bodies: contract.body_registry()?,
            history: SurfaceHistory::default(),
            unavailable: contract.unavailable_labels(),
        })
    }

    /// Resolve one omnibox intent and record it.
    fn intent(&self, step: &str, raw: &str) -> Option<ResolvedIntent> {
        self.catalog.resolve(raw).ok().map(|mount| ResolvedIntent {
            step: step.to_owned(),
            intent: raw.to_owned(),
            surface_id: mount.surface.surface_id,
            binding: mount.binding,
        })
    }

    /// Drive the omnibox and the back/forward stack through the host's own
    /// logic, so a receipt reports real behavior.
    ///
    /// TW3 requires a record identifier to open the record surface at `Record`
    /// scope, a question to open the chat surface at `Workspace` scope, and
    /// back and forward to restore both surface and binding.
    fn exercise(&mut self) -> (Vec<ResolvedIntent>, Vec<ResolvedIntent>) {
        let record = self.intent("record", "record:company:acme");
        let question = self.intent("question", "What changed?");
        let mut history = Vec::new();
        if let (Some(record), Some(question)) = (record.clone(), question.clone()) {
            for raw in ["record:company:acme", "What changed?"] {
                if let Ok(mount) = self.catalog.resolve(raw) {
                    self.history.push(mount);
                }
            }
            if let Some(back) = self.history.back() {
                history.push(ResolvedIntent {
                    step: "back".to_owned(),
                    intent: record.intent.clone(),
                    surface_id: back.surface.surface_id.clone(),
                    binding: back.binding.clone(),
                });
            }
            if let Some(forward) = self.history.forward() {
                history.push(ResolvedIntent {
                    step: "forward".to_owned(),
                    intent: question.intent.clone(),
                    surface_id: forward.surface.surface_id.clone(),
                    binding: forward.binding.clone(),
                });
            }
        }
        (vec![record, question].into_iter().flatten().collect(), history)
    }

    /// Describe the boot for a verification receipt.
    pub fn receipt(&mut self, contract: &SurfaceContract, endpoints: &SeedEndpoints) -> BootReceipt {
        let (intents, history) = self.exercise();
        BootReceipt {
            intents,
            history,
            contract_version: contract.version.clone(),
            surface_ids: contract
                .surfaces
                .iter()
                .map(|surface| surface.surface_id.clone())
                .collect(),
            body_kinds: self
                .bodies
                .kinds()
                .into_iter()
                .map(str::to_owned)
                .collect(),
            missing_seed_ids: missing_ids(&contract.surfaces, endpoints),
            unavailable_labels: self
                .unavailable
                .iter()
                .map(|(id, label)| format!("{id}: {label}"))
                .collect(),
            registry_source: "canonical-document",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A canonical document shaped the way the backend publishes it.
    fn document() -> String {
        let bodies: Vec<String> = [
            "fields",
            "related_records",
            "record_table",
            "thread",
            "document",
            "chart",
            "timeline",
            "iframe",
            "sub_canvas",
            "log",
        ]
        .iter()
        .map(|kind| {
            format!(
                r#"{{"kind":"{kind}","title":"{kind}","icon":"{kind}",
                     "renderer_binding":"theorem.body.{kind}",
                     "size":{{"min_width":240,"min_height":160,
                              "default_width":480,"default_height":320}}}}"#
            )
        })
        .collect();
        let endpoints = endpoints();
        let surfaces: Vec<String> = initial_surfaces(&endpoints)
            .iter()
            .map(|surface| serde_json::to_string(surface).expect("seed row encodes"))
            .collect();
        format!(
            r#"{{"version":"{CONTRACT_VERSION}","bodies":[{}],"surfaces":[{}]}}"#,
            bodies.join(","),
            surfaces.join(",")
        )
    }

    fn endpoints() -> SeedEndpoints {
        SeedEndpoints {
            ide_url: "https://ide.example/".into(),
            browser_url: "https://browser.example/".into(),
        }
    }

    #[test]
    fn the_host_boots_all_seven_rows_and_ten_bodies_from_one_document() {
        let contract = SurfaceContract::parse(document().as_bytes()).expect("document parses");
        let mut boot = Boot::resolve(&contract).expect("host resolves");
        let receipt = boot.receipt(&contract, &endpoints());
        assert_eq!(receipt.surface_ids.len(), 7);
        assert_eq!(receipt.body_kinds.len(), 10);
        assert!(receipt.missing_seed_ids.is_empty());
        assert_eq!(receipt.registry_source, "canonical-document");
    }

    #[test]
    fn the_receipt_reports_real_omnibox_and_history_behavior() {
        let contract = SurfaceContract::parse(document().as_bytes()).expect("document parses");
        let mut boot = Boot::resolve(&contract).expect("host resolves");
        let receipt = boot.receipt(&contract, &endpoints());
        let steps: Vec<&str> = receipt.intents.iter().map(|i| i.step.as_str()).collect();
        assert_eq!(steps, ["record", "question"]);
        assert_eq!(receipt.intents[0].surface_id, "records");
        assert_eq!(receipt.intents[1].surface_id, "chat");
        let history: Vec<&str> = receipt.history.iter().map(|i| i.step.as_str()).collect();
        assert_eq!(history, ["back", "forward"]);
        assert_eq!(receipt.history[0].surface_id, "records");
        assert_eq!(receipt.history[1].surface_id, "chat");
    }

    #[test]
    fn omnibox_intents_resolve_against_canonical_rows_not_a_client_list() {
        let contract = SurfaceContract::parse(document().as_bytes()).expect("document parses");
        let boot = Boot::resolve(&contract).expect("host resolves");
        let record = boot
            .catalog
            .resolve("record:company:acme")
            .expect("record intent resolves");
        assert_eq!(record.surface.surface_id, "records");
        let question = boot
            .catalog
            .resolve("What changed?")
            .expect("question intent resolves against the canonical thread body");
        assert_eq!(question.surface.surface_id, "chat");
    }

    #[test]
    fn back_and_forward_restore_surface_and_binding_together() {
        let contract = SurfaceContract::parse(document().as_bytes()).expect("document parses");
        let mut boot = Boot::resolve(&contract).expect("host resolves");
        let record = boot.catalog.resolve("record:company:acme").expect("record");
        let question = boot.catalog.resolve("Why now?").expect("question");
        boot.history.push(record.clone());
        boot.history.push(question.clone());
        assert_eq!(boot.history.back(), Some(&record));
        assert_eq!(boot.history.forward(), Some(&question));

        let encoded = boot.history.encode_browser_state().expect("history encodes");
        let restored = SurfaceHistory::restore_browser_state(&encoded).expect("history restores");
        assert_eq!(restored.current(), Some(&question));
    }

    #[test]
    fn a_wrong_contract_version_refuses_the_boot_instead_of_falling_back() {
        let skewed = document().replace(CONTRACT_VERSION, "theoremweb-surface-v2");
        let error = SurfaceContract::parse(skewed.as_bytes()).unwrap_err();
        assert!(matches!(error, RegistryError::VersionMismatch { .. }));
    }

    #[test]
    fn a_document_with_no_bodies_refuses_rather_than_using_a_built_in_list() {
        let stripped = document().replace(r#""bodies":["#, r#""bodies":[],"unused":["#);
        let contract = SurfaceContract::parse(stripped.as_bytes()).expect("still valid json");
        assert_eq!(contract.body_registry().unwrap_err(), RegistryError::NoBodies);
    }

    #[test]
    fn an_unknown_future_renderer_is_labeled_and_kept() {
        let mut contract =
            SurfaceContract::parse(document().as_bytes()).expect("document parses");
        let future: theoremweb_app::SurfaceSpec = serde_json::from_str(
            r#"{"surface_id":"future","title":"Future","icon":"spark",
                "default_scope":{"kind":"workspace"},
                "renderer":{"kind":"future_gpu","quality":"high"}}"#,
        )
        .expect("unknown renderer decodes as a labeled row");
        contract.surfaces.push(future);
        let boot = Boot::resolve(&contract).expect("unknown renderer does not stop the boot");
        assert_eq!(
            boot.unavailable,
            vec![(
                "future".to_owned(),
                "Unavailable renderer: future_gpu".to_owned()
            )]
        );
    }
}
