//! Shared behavior for the native and web CommonPlace data consoles.
//!
//! The crate owns the request and response contract, deterministic fixtures,
//! formatting, diffing, watch inspection, and force simulation. Realm adapters
//! own authentication, GraphQL or subscription transport, and painting.

pub mod diff;
pub mod door;
pub mod fixture;
pub mod format;
pub mod graphql;
pub mod model;
pub mod sim;
pub mod watch;

pub use diff::{diff_entities, EntityDiff, FieldChange};
pub use door::{
    entity, neighborhood, overview, receipts, snapshot, Door, DoorSubscription, SubscriptionSink,
};
pub use fixture::{fixture_snapshot, FixtureDoor};
pub use model::*;
pub use sim::{ForceSim, ForceSimConfig, NodePos, SimBackend, SimError};
pub use watch::{
    WatchBuffer, WatchConfig, WatchError, WatchFilter, WatchInspector, WatchSnapshot, WatchStats,
};

#[cfg(target_arch = "wasm32")]
mod wasm {
    use std::cell::RefCell;

    use wasm_bindgen::prelude::*;

    thread_local! {
        static FIXTURE_JSON: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    }

    /// Return the canonical fixture through the same serde contract used by
    /// native callers. The web package uses this export for its offline and
    /// cross-realm honesty fixture.
    #[wasm_bindgen(js_name = fixtureSnapshot)]
    pub fn fixture_snapshot_js() -> Result<JsValue, JsValue> {
        serde_wasm_bindgen::to_value(&crate::fixture_snapshot())
            .map_err(|error| JsValue::from_str(&error.to_string()))
    }

    /// Format an arbitrary JSON value with the core's stable formatter.
    #[wasm_bindgen(js_name = formatJson)]
    pub fn format_json_js(value: JsValue) -> Result<String, JsValue> {
        let value = serde_wasm_bindgen::from_value(value)
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        Ok(crate::format::format_value(&value))
    }

    /// Prepare a raw JSON buffer for runtime parity checks that instantiate the
    /// wasm artifact without generated JavaScript glue.
    #[no_mangle]
    pub extern "C" fn commonplace_console_fixture_json_prepare() -> u32 {
        FIXTURE_JSON.with(|buffer| {
            let mut buffer = buffer.borrow_mut();
            *buffer = serde_json::to_vec(&crate::fixture_snapshot())
                .expect("fixture serialization must remain valid");
            buffer.len() as u32
        })
    }

    #[no_mangle]
    pub extern "C" fn commonplace_console_fixture_json_ptr() -> u32 {
        FIXTURE_JSON.with(|buffer| buffer.borrow().as_ptr() as u32)
    }
}
