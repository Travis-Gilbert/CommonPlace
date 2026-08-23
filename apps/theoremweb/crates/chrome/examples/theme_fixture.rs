//! Browser-computed-style fixture for SPEC-THEOREMWEB-SURFACE-1.0 V02.
//!
//! The theme source and donor notices live in the library crate. This example
//! only mounts deterministic probes for a real browser oracle.

use theoremweb_chrome::{emit_chrome_theme_css, ColumnSize};

fn main() {
    let css = emit_chrome_theme_css(&[ColumnSize {
        field_key: "Name",
        width: 180,
    }])
    .expect("fixture column is valid");

    println!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>TheoremWeb theme density oracle</title>
  <style>{css}</style>
  <style>
    body {{ margin: 0; }}
    .scheme {{ background: var(--background); color: var(--foreground); padding: 16px; }}
    .theorem-record-row {{ display: flex; }}
    .theorem-record-cell {{ width: calc(var(--col-Name-size) * 1px); }}
    .tag {{ color: var(--t-tag-text-blue); background: var(--t-tag-background-blue); }}
  </style>
</head>
<body>
  <section id="light" class="scheme light">
    <div id="light-row" class="theorem-record-row">
      <div id="light-select" class="theorem-record-select"></div>
      <div id="light-cell" class="theorem-record-cell">Light row</div>
      <span id="light-tag" class="tag">Blue</span>
    </div>
  </section>
  <section id="dark" class="scheme dark">
    <div id="dark-row" class="theorem-record-row">
      <div id="dark-select" class="theorem-record-select"></div>
      <div id="dark-cell" class="theorem-record-cell">Dark row</div>
      <span id="dark-tag" class="tag">Blue</span>
    </div>
  </section>
</body>
</html>"#
    );
}
