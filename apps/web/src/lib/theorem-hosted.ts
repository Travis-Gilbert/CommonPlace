// The harness backend (agent run, GraphQL, MCP, RustyWeb search) is the Railway
// service at api.theoremharness.com. app.theoremharness.com is the CommonPlace
// FRONTEND (product surface) and does not serve these paths, so using it as the
// origin returns 404 for every harness call. The product surface constant in
// theorem-control-center.ts correctly stays app.theoremharness.com.
export const THEOREM_HARNESS_ORIGIN = 'https://api.theoremharness.com';
export const THEOREM_HARNESS_AGENT_RUN_URL = `${THEOREM_HARNESS_ORIGIN}/v1/theorem/agent/run`;
export const THEOREM_HARNESS_GRAPHQL_URL = `${THEOREM_HARNESS_ORIGIN}/graphql`;
export const THEOREM_HARNESS_MCP_URL = `${THEOREM_HARNESS_ORIGIN}/mcp`;
export const THEOREM_HARNESS_RUSTYWEB_SEARCH_URL = `${THEOREM_HARNESS_ORIGIN}/v1/rustyweb/search`;
