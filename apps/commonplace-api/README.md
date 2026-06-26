# CommonPlace API

This is the backend block contract/API seam in the CommonPlace product repo. It
exposes the local `crates/commonplace` object model through GraphQL, MCP,
import, export, organize, briefing, discovery, and ask surfaces.

The crate still bridges to the Theorem checkout for the underlying RustyRed and
harness crates:

```text
Website/
  CommonPlace/
  Theorem/
```

That keeps this migration honest without duplicating Theorem internals. The
CommonPlace product object model lives locally; the next backend packaging pass
should replace the remaining sibling `path` dependencies with published crates,
git-pinned crates, or vendored CommonPlace-owned adapters.
