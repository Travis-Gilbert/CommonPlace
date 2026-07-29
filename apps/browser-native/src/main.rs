//! browser-native entrypoints.
//!
//! - Default mock build: `--proof` runs the F3 scripted proof window.
//! - `gpui` feature: launches the real CommonPlace window.

#[cfg(feature = "gpui")]
fn main() {
    if std::env::args().any(|arg| arg == "--proof") {
        run_proof();
        return;
    }
    if let Err(error) = browser_native::native::run() {
        eprintln!("CommonPlace native shell could not start: {error:#}");
        std::process::exit(1);
    }
}

#[cfg(not(feature = "gpui"))]
fn main() {
    if std::env::args().any(|arg| arg == "--proof") {
        run_proof();
        return;
    }
    eprintln!(
        "browser-native was built without the `gpui` feature\n\
         Run the scripted proof window with: cargo run --manifest-path apps/browser-native/Cargo.toml -- --proof"
    );
}

fn run_proof() {
    use browser_native::proof::{registration_report, run_proof_window, ProofStatus};
    use serde_json::json;

    let points = run_proof_window();
    let passed = points
        .iter()
        .filter(|p| p.status == ProofStatus::Passed)
        .count();
    let blocked = points
        .iter()
        .filter(|p| p.status == ProofStatus::Blocked)
        .count();
    let report = json!({
        "suite": "SPEC-COMMONPLACE-NATIVE-SHELL-1.0/F3",
        "passed": passed,
        "blocked": blocked,
        "points": points.iter().map(|p| json!({
            "id": p.id,
            "status": match p.status {
                ProofStatus::Passed => "passed",
                ProofStatus::Blocked => "blocked",
            },
            "detail": p.detail,
        })).collect::<Vec<_>>(),
        "registration": registration_report(),
        "captures": browser_native::proof::capture_evidence_report(),
    });
    println!("{}", serde_json::to_string_pretty(&report).unwrap());

    // SR-008 API seams are closed; any Blocked point is a regression.
    let regression = points.iter().any(|p| p.status == ProofStatus::Blocked);
    if regression {
        eprintln!("proof window: unexpected blocked points");
        std::process::exit(1);
    }
}
