//! The `TheoremWeb` binary.
//!
//! On wasm it launches the product against the live canonical registry. On the
//! host machine it resolves the same boot from a canonical document on disk and
//! prints a receipt, which is what lets W01's proof commands and V01's oracle
//! check the real boot path without a browser.

fn main() {
    #[cfg(target_arch = "wasm32")]
    wasm::launch();
    #[cfg(not(target_arch = "wasm32"))]
    native::main();
}

#[cfg(target_arch = "wasm32")]
mod wasm {
    use dioxus::prelude::*;
    use std::collections::BTreeMap;

    use theoremweb_host::{layouts, records, registry, Boot, HostModel, TheoremWebHost};
    use theoremweb_layout::{LayoutMcpCall, LayoutSet};
    use theoremweb_record_table::{RecordPage, RecordTableAction};

    /// Where the canonical registry document is served, injected at build time
    /// so a deployment can point the host at its own gateway.
    const REGISTRY_BASE: &str = match option_env!("THEOREMWEB_REGISTRY_BASE") {
        Some(base) => base,
        None => "/api/theoremweb/registry",
    };

    pub fn launch() {
        dioxus::launch(Root);
    }

    #[component]
    fn Root() -> Element {
        let contract = use_resource(|| async { registry::fetch(REGISTRY_BASE).await });
        match &*contract.read_unchecked() {
            None => rsx! { p { "Resolving the surface registry" } },
            Some(Err(error)) => rsx! { p { role: "alert", "{error}" } },
            Some(Ok(contract)) => match Boot::resolve(contract) {
                Err(error) => rsx! { p { role: "alert", "{error}" } },
                Ok(boot) => rsx! {
                    Mounted { catalog: boot.catalog.clone(), bodies: boot.bodies.clone() }
                },
            },
        }
    }

    /// The host once the registry has resolved.
    ///
    /// Record data is fetched separately from the registry, because a surface
    /// row is cheap and always needed while a record page is expensive and
    /// only needed by the surfaces that render one.
    #[component]
    fn Mounted(
        catalog: theoremweb_app::SurfaceCatalog,
        bodies: theoremweb_layout::BodyRegistry,
    ) -> Element {
        let current = catalog
            .surfaces()
            .iter()
            .find(|surface| surface.renderer.body_kind() == Some("record_table"))
            .or_else(|| catalog.surfaces().first())
            .map(|surface| theoremweb_app::SurfaceMount {
                binding: surface.default_scope.clone(),
                surface: surface.clone(),
            });
        let surface_key = current
            .as_ref()
            .map(|mount| mount.surface.surface_id.clone());
        let records_key = current.as_ref().and_then(|mount| {
            (mount.surface.renderer.body_kind() == Some("record_table"))
                .then(|| mount.surface.surface_id.clone())
        });
        let mut record_page = use_signal(|| None::<RecordPage>);
        let _page = use_resource(move || {
            let key = records_key.clone();
            async move {
                let next = match key {
                    Some(key) => records::fetch(REGISTRY_BASE, &key).await.ok(),
                    None => None,
                };
                record_page.set(next);
            }
        });

        // Layouts and aggregates are keyed by surface id like records are, so
        // the server stays the authority on which surfaces have a layout and
        // which numbers a dashboard is entitled to show.
        let layouts_key = surface_key.clone();
        let layouts = use_resource(move || {
            let key = layouts_key.clone();
            async move {
                match key {
                    Some(key) => layouts::fetch(REGISTRY_BASE, &key)
                        .await
                        .unwrap_or_default(),
                    None => LayoutSet::default(),
                }
            }
        });

        let aggregates_key = surface_key;
        let server_values = use_resource(move || {
            let key = aggregates_key.clone();
            async move {
                let Some(key) = key else {
                    return BTreeMap::new();
                };
                let receipts = layouts::fetch_aggregates(REGISTRY_BASE, &key)
                    .await
                    .unwrap_or_default();
                // A page-scoped receipt refuses the whole projection. The
                // charts then render "Server result unavailable", which is the
                // correct degradation: a missing number beats a wrong one.
                theoremweb_layout::project_server_aggregates(receipts).unwrap_or_default()
            }
        });

        let records = record_page();
        let action_surface = current.as_ref().and_then(|mount| {
            (mount.surface.renderer.body_kind() == Some("record_table"))
                .then(|| mount.surface.surface_id.clone())
        });

        let model = HostModel {
            navigation: theoremweb_navigation::NavigationState::default(),
            catalog,
            bodies,
            current,
            records,
            layouts: layouts.read_unchecked().clone().unwrap_or_default(),
            server_values: server_values.read_unchecked().clone().unwrap_or_default(),
            scheme: theoremweb_chrome::ColorScheme::Light,
        };
        rsx! {
            TheoremWebHost {
                model,
                on_persist: move |call: LayoutMcpCall| {
                    spawn(async move {
                        // A refused write must not read as saved. There is no
                        // optimistic rollback here yet: the draft keeps the
                        // geometry and the next reload is the correction.
                        if let Err(error) = layouts::persist(REGISTRY_BASE, &call).await {
                            dioxus::logger::tracing::error!("layout_write failed: {error}");
                        }
                    });
                },
                on_record_action: move |action: RecordTableAction| {
                    let Some(surface_id) = action_surface.clone() else {
                        return;
                    };
                    let rollback = record_page();
                    let was_edit = matches!(action, RecordTableAction::Edit { .. });
                    record_page.with_mut(|page| {
                        if let Some(page) = page {
                            records::apply_optimistic_edit(page, &action);
                        }
                    });
                    spawn(async move {
                        match records::dispatch(REGISTRY_BASE, &surface_id, &action).await {
                            Ok(page) => record_page.set(Some(page)),
                            Err(error) => {
                                let mut restored = rollback;
                                if let Some(page) = restored.as_mut() {
                                    page.notice = Some(if was_edit {
                                        format!(
                                            "{:?} enforcement: {error}",
                                            page.object_type.enforcement
                                        )
                                    } else {
                                        format!("Record action refused: {error}")
                                    });
                                }
                                record_page.set(restored);
                            }
                        }
                    });
                },
            }
        }
    }
}

#[cfg(not(target_arch = "wasm32"))]
mod native {
    use theoremweb_host::{Boot, SeedEndpoints, SurfaceContract};

    pub fn main() {
        if let Err(reason) = run() {
            eprintln!("{reason}");
            std::process::exit(1);
        }
    }

    fn run() -> Result<(), String> {
        let path = std::env::args()
            .nth(1)
            .ok_or_else(|| "usage: theoremweb <canonical-registry-document.json>".to_owned())?;
        let bytes = std::fs::read(&path).map_err(|error| format!("{path}: {error}"))?;
        let contract = SurfaceContract::parse(&bytes).map_err(|error| error.to_string())?;
        let mut boot = Boot::resolve(&contract).map_err(|error| error.to_string())?;
        let endpoints = SeedEndpoints {
            ide_url: std::env::var("THEOREMWEB_IDE_URL").unwrap_or_default(),
            browser_url: std::env::var("THEOREMWEB_BROWSER_URL").unwrap_or_default(),
        };
        let receipt = boot.receipt(&contract, &endpoints);
        let encoded = serde_json::to_string_pretty(&receipt).map_err(|error| error.to_string())?;
        println!("{encoded}");
        Ok(())
    }
}
