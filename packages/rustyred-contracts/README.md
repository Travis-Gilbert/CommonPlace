# @commonplace/rustyred-contracts

This package is the CommonPlace-side boundary for RustyRed contracts.

For now it contains the pinned RustyRed source SHA in `rustyred-source.json`.
The update workflow changes that pin and opens a PR. As CommonPlace grows, this
package should also hold generated TypeScript/Rust contracts derived from that
same source revision.

Do not copy RustyRed runtime code into the web app by hand. Update the source
pin, generate from the pin, and let the CommonPlace app consume the package.
