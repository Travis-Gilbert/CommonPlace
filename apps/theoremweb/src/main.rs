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
    use theoremweb_host::{records, registry, Boot, HostModel, TheoremWebHost};

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
        let records_key = current.as_ref().and_then(|mount| {
            (mount.surface.renderer.body_kind() == Some("record_table"))
                .then(|| mount.surface.surface_id.clone())
        });
        let page = use_resource(move || {
            let key = records_key.clone();
            async move {
                match key {
                    Some(key) => records::fetch(REGISTRY_BASE, &key).await.ok(),
                    None => None,
                }
            }
        });
        let model = HostModel {
            navigation: theoremweb_navigation::NavigationState::default(),
            catalog,
            bodies,
            current,
            records: page.read_unchecked().clone().flatten(),
            scheme: theoremweb_chrome::ColorScheme::Light,
        };
        rsx! { TheoremWebHost { model } }
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
        let path = std::env::args().nth(1).ok_or_else(|| {
            "usage: theoremweb <canonical-registry-document.json>".to_owned()
        })?;
        let bytes = std::fs::read(&path).map_err(|error| format!("{path}: {error}"))?;
        let contract = SurfaceContract::parse(&bytes).map_err(|error| error.to_string())?;
        let mut boot = Boot::resolve(&contract).map_err(|error| error.to_string())?;
        let endpoints = SeedEndpoints {
            ide_url: std::env::var("THEOREMWEB_IDE_URL").unwrap_or_default(),
            browser_url: std::env::var("THEOREMWEB_BROWSER_URL").unwrap_or_default(),
        };
        let receipt = boot.receipt(&contract, &endpoints);
        let encoded =
            serde_json::to_string_pretty(&receipt).map_err(|error| error.to_string())?;
        println!("{encoded}");
        Ok(())
    }
}
