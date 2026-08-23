//! The TheoremWeb binary.
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
    use theoremweb_host::{registry, Boot, HostModel, TheoremWebHost};

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
                Ok(boot) => {
                    let current = boot.catalog.surfaces().first().map(|surface| {
                        theoremweb_app::SurfaceMount {
                            binding: surface.default_scope.clone(),
                            surface: surface.clone(),
                        }
                    });
                    let model = HostModel {
                        navigation: theoremweb_navigation::NavigationState::default(),
                        catalog: boot.catalog.clone(),
                        bodies: boot.bodies.clone(),
                        current,
                    };
                    rsx! { TheoremWebHost { model } }
                }
            },
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
