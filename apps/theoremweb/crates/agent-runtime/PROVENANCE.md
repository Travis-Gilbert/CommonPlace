# Agent runtime provenance

The initial stream parser and thread-state donor was read from `Travis-Gilbert/Theorem` commit `1c5c3eaec8b008eede91a2079db0e39e2fe8439a`, branch `Travis-Gilbert/theorem-ui-shell`, under `UI/agent-runtime`. The donor remained read-only; this CommonPlace crate is the frontend-owned continuation.

The UI-message wire contract is bound to Vercel AI SDK 5.0.0's `UIMessageChunk` union and `DataUIPart` contract, whose primary implementation is `packages/ai/src/ui-message-stream/ui-message-chunks.ts` in `vercel/ai`. The CommonPlace code is an independent Rust wire implementation and retains unknown JSON rather than copying TypeScript implementation code.

