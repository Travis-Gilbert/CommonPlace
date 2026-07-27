use commonplace_console_native::{
    DockHost, FileDockHost, NativeShell, Shell, SurfaceHost, SurfaceId, SurfaceRegistry,
};

#[test]
fn public_shell_contract_is_realm_neutral() {
    let source = include_str!("../src/shell.rs");
    assert!(!source.contains("gpui::"));
    assert!(!source.contains("use gpui"));

    let dock = FileDockHost::new("test-layout", std::env::temp_dir().join("unused-layout"));
    let mut shell = NativeShell::new(dock, SurfaceRegistry::default());
    assert_eq!(shell.dock_host().layout_key(), "test-layout");
    assert_eq!(shell.surface_host().surfaces(), SurfaceId::ALL);
    shell.surface_host_mut().activate_surface(SurfaceId::Graph);
    assert_eq!(shell.surface_host().active_surface(), SurfaceId::Graph);
}
