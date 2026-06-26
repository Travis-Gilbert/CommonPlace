#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    commonplace_desktop_runtime::run(tauri::generate_context!());
}
