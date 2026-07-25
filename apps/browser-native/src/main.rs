#[cfg(feature = "gpui")]
fn main() {
    if let Err(error) = browser_native::native::run() {
        eprintln!("CommonPlace native shell could not start: {error:#}");
        std::process::exit(1);
    }
}

#[cfg(not(feature = "gpui"))]
fn main() {
    eprintln!("browser-native was built without the `gpui` feature");
}
