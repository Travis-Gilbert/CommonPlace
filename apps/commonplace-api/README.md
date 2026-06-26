# CommonPlace API

This is the backend block contract/API seam moved into the CommonPlace product
repo. It exposes the CommonPlace object model through GraphQL, MCP, import,
export, organize, briefing, discovery, and ask surfaces.

The crate still bridges to the Theorem checkout for the underlying RustyRed and
harness crates:

```text
Website/
  CommonPlace/
  Theorem/
```

That keeps this migration honest without duplicating Theorem internals. The next
backend packaging pass should replace those sibling `path` dependencies with
published crates, git-pinned crates, or vendored CommonPlace-owned adapters.
