fn main() {
    let encoded = serde_json::to_string(&commonplace_console_core::fixture_snapshot())
        .expect("fixture serialization must remain valid");
    println!("{encoded}");
}
