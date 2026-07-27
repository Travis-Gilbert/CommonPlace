use std::sync::Arc;

use commonplace_console_native::{NativeConsoleModel, ui};

fn main() -> anyhow::Result<()> {
    let model = Arc::new(NativeConsoleModel::seeded());
    if std::env::args().any(|argument| argument == "--smoke") {
        println!("{}", serde_json::to_string_pretty(&model.smoke_receipt())?);
        return Ok(());
    }

    ui::run(model);
    Ok(())
}
