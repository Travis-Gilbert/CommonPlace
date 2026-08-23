//! The seven initial `SurfaceSpec` rows.
//!
//! SPEC-THEOREMWEB-SURFACE-1.0 TW1 fixes the initial row set exactly:
//! canvas, records, model, chat, document, ide, browser. Nothing in either
//! repository seeded them before; the oracles used ad-hoc ids such as
//! `tenant-records` and `future-canvas`, which is why no fresh tenant ever
//! booted a complete product.
//!
//! Body kinds here are drawn from the canonical set the spec fixes at its
//! `BodyKind` line: fields, `related_records`, `record_table`, thread,
//! document, chart, timeline, iframe, `sub_canvas`, log. `agent_thread` is
//! deliberately
//! absent: it appears in the old client resolver and in the old oracle, but it
//! is not a canonical kind, so a row using it can never resolve against a
//! canonical registry.

use theoremweb_app::{Renderer, ScopeBinding, SurfaceSpec};

/// URLs for the two rows the spec renders through a browser engine.
///
/// IDE1 requires `Renderer::Servo(url)` with a declared `SystemWebview(url)`
/// fallback on the same row, so a fallback flip stays one record edit.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SeedEndpoints {
    pub ide_url: String,
    pub browser_url: String,
}

/// The seven rows a fresh tenant must have.
#[must_use]
pub fn initial_surfaces(endpoints: &SeedEndpoints) -> Vec<SurfaceSpec> {
    vec![
        dioxus_row("canvas", "Canvas", "canvas", "sub_canvas", &["canvas.read"]),
        dioxus_row("records", "Records", "table", "record_table", &["records.read"]),
        dioxus_row("model", "Model", "fields", "fields", &["schema.read"]),
        dioxus_row("chat", "Chat", "message", "thread", &["threads.read"]),
        dioxus_row("document", "Document", "document", "document", &["documents.read"]),
        engine_row("ide", "IDE", "code", &endpoints.ide_url, &["ide.read", "ide.write"]),
        engine_row("browser", "Browser", "browser", &endpoints.browser_url, &["browser.read"]),
    ]
}

/// The rows that are missing from a tenant, in seed order.
///
/// Writing only absent rows is what makes seeding safe to re-run. TW1 lets a
/// tenant rename or replace any row, so an unconditional upsert would revert
/// their edits on every boot while still looking idempotent.
#[must_use]
pub fn plan_seed(existing: &[SurfaceSpec], endpoints: &SeedEndpoints) -> Vec<SurfaceSpec> {
    initial_surfaces(endpoints)
        .into_iter()
        .filter(|row| {
            !existing
                .iter()
                .any(|present| present.surface_id == row.surface_id)
        })
        .collect()
}

/// Seed row ids that are still absent after a seed pass.
///
/// V01 asserts against this: an empty result is the whole claim that a fresh
/// tenant boots all seven rows from graph truth.
#[must_use]
pub fn missing_ids(existing: &[SurfaceSpec], endpoints: &SeedEndpoints) -> Vec<String> {
    plan_seed(existing, endpoints)
        .into_iter()
        .map(|row| row.surface_id)
        .collect()
}

fn dioxus_row(
    surface_id: &str,
    title: &str,
    icon: &str,
    body_kind: &str,
    capabilities: &[&str],
) -> SurfaceSpec {
    SurfaceSpec {
        surface_id: surface_id.to_owned(),
        title: title.to_owned(),
        icon: icon.to_owned(),
        default_scope: ScopeBinding::Workspace,
        renderer: Renderer::Dioxus(body_kind.to_owned()),
        fallback_renderer: None,
        layout_ref: None,
        capabilities: capabilities.iter().map(|value| (*value).to_owned()).collect(),
    }
}

fn engine_row(
    surface_id: &str,
    title: &str,
    icon: &str,
    url: &str,
    capabilities: &[&str],
) -> SurfaceSpec {
    SurfaceSpec {
        surface_id: surface_id.to_owned(),
        title: title.to_owned(),
        icon: icon.to_owned(),
        default_scope: ScopeBinding::Workspace,
        renderer: Renderer::Servo(url.to_owned()),
        fallback_renderer: Some(Renderer::SystemWebview(url.to_owned())),
        layout_ref: None,
        capabilities: capabilities.iter().map(|value| (*value).to_owned()).collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn endpoints() -> SeedEndpoints {
        SeedEndpoints {
            ide_url: "https://ide.example/".into(),
            browser_url: "https://browser.example/".into(),
        }
    }

    #[test]
    fn the_initial_set_is_exactly_the_seven_the_spec_names() {
        let rows = initial_surfaces(&endpoints());
        let ids: Vec<&str> = rows.iter().map(|row| row.surface_id.as_str()).collect();
        assert_eq!(
            ids,
            ["canvas", "records", "model", "chat", "document", "ide", "browser"]
        );
    }

    #[test]
    fn no_seed_row_uses_a_non_canonical_body_kind() {
        // The canonical set, verbatim from the spec's BodyKind line.
        let canonical = [
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
        ];
        for row in initial_surfaces(&endpoints()) {
            if let Some(kind) = row.renderer.body_kind() {
                assert!(
                    canonical.contains(&kind),
                    "{} renders non-canonical body kind {kind}",
                    row.surface_id
                );
            }
        }
    }

    #[test]
    fn the_engine_rows_declare_a_reversible_fallback() {
        let rows = initial_surfaces(&endpoints());
        for id in ["ide", "browser"] {
            let row = rows
                .iter()
                .find(|row| row.surface_id == id)
                .expect("engine row is seeded");
            assert!(matches!(row.renderer, Renderer::Servo(_)));
            assert!(matches!(
                row.fallback_renderer,
                Some(Renderer::SystemWebview(_))
            ));
        }
    }

    #[test]
    fn seeding_a_fresh_tenant_plans_all_seven() {
        assert_eq!(plan_seed(&[], &endpoints()).len(), 7);
    }

    #[test]
    fn reseeding_writes_nothing_and_never_reverts_a_renamed_row() {
        let mut tenant = initial_surfaces(&endpoints());
        tenant[1].title = "Our Records".into();
        assert!(plan_seed(&tenant, &endpoints()).is_empty());
        assert!(missing_ids(&tenant, &endpoints()).is_empty());
        assert_eq!(tenant[1].title, "Our Records");
    }

    #[test]
    fn a_deleted_row_is_the_only_one_replanned() {
        let mut tenant = initial_surfaces(&endpoints());
        tenant.retain(|row| row.surface_id != "chat");
        assert_eq!(missing_ids(&tenant, &endpoints()), ["chat"]);
    }
}
