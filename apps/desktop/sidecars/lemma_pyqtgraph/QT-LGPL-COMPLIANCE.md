# Qt / PySide6 LGPL-3.0 Compliance — Lemma sidecar

CommonPlace selects the **LGPL-3.0-only** dynamic-distribution path for PySide6
`6.11.1` used by the Lemma pyqtgraph helper. GPL and commercial Qt alternatives
are out of scope unless a later Plan decision changes the boundary.

## Notices

- Qt and PySide6 are copyright The Qt Company Ltd. and/or its subsidiaries.
- Distribution must retain LGPL-3.0 notices with the Lemma helper package.
- Users may replace the dynamically linked PySide6 libraries with a compatible
  LGPL build; relink instructions: install an alternate PySide6 6.11.1 wheel set
  into the sidecar virtualenv and restart the Lemma helper process.

## Dynamic linking boundary

- Theorem supplies only versioned DatasetVersion / Arrow Flight contracts.
- The Lemma helper is a separately packaged Python process under CommonPlace
  desktop ownership; it must not statically link Qt into Theorem MIT crates.

## Source offer

- Corresponding PySide6 / Qt source for the pinned wheels is available from the
  upstream PyPI / Qt Company release channels for version `6.11.1`.
- Exact wheel hashes for completed platforms live in `requirements.lock`.

## Matrix status

- macOS universal PySide6 meta-wheel: verified
  `sha256:537682c3b7530817203e667c1f5a2f00486b37bf52c52eeab438544c7a0917f6`
- Linux / Windows (and Addons/Essentials/shiboken6 per-arch hashes): **incomplete**
  — PG-07 cannot close until every declared release target is listed.
