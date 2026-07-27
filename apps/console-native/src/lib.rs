pub mod model;
pub mod shell;
pub mod ui;

pub use model::{NativeConsoleModel, NativeSmokeReceipt};
pub use shell::{
    DockHost, FileDockHost, NativeShell, Shell, SurfaceHost, SurfaceId, SurfaceRegistry,
};

pub const GPUI_COMPONENT_VERSION: &str = "0.5.1";
pub const GPUI_COMPONENT_COMMIT: &str = "0f0ab35233212f8f3277028995caf0c41e13ee6c";
pub const GPUI_VERSION: &str = "0.2.2";
pub const GPUI_COMMIT: &str = "69e2130295c2649963eb639fc70b4f2ee8ea1624";
