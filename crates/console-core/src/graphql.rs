//! Versioned GraphQL documents used by real realm adapters.
//!
//! The console aggregation fields are the target door contract. The plugin
//! documents match the audited plugin branch exactly. The CommonPlace mainline
//! server does not expose the aggregation or subscription fields yet, so the
//! adapters must surface `unavailable` instead of falling back to store access.

pub const CONSOLE_READS: &str = r#"
query CommonPlaceConsoleSnapshot($root: ID!, $depth: Int!, $receiptLimit: Int!, $receiptCursor: String) {
  consoleOverview { countsByType { nodeType count } generation readiness { capability state detail } }
  consoleEntities { record merges receipts candidates }
  consoleReceipts(first: $receiptLimit, after: $receiptCursor) { receipts nextCursor total }
  consoleNeighborhood(root: $root, depth: $depth) { root depth nodes edges }
  standingQueries { id name shape enabled }
  standingFirings(limit: 50) { queryId sequence occurredAtMs matchedIds receiptId }
}
"#;

pub const PLUGIN_STATE: &str = r#"
query CommonPlaceConsolePluginState {
  installedApps { appId version state requiredConformanceLevel contributions { point block kind value } grants }
  pendingApps { appId version state draftedBy requiredConformanceLevel contributions { point block kind value } contributionsActive grants manifest }
}
"#;

pub const PLUGIN_CONSENT: &str = r#"
mutation ConsentCommonPlaceConsole($appId: String!) {
  consentApp(appId: $appId) { appId toolsAdded seedsCreated contributions grants }
}
"#;

pub const PLUGIN_DENY: &str = r#"
mutation DenyCommonPlaceConsole($appId: String!) {
  denyApp(appId: $appId) { appId draftNodeId draftRemoved contributionsRemoved grantsDeclined }
}
"#;

pub const PLUGIN_UNINSTALL: &str = r#"
mutation UninstallCommonPlaceConsole($appId: String!) {
  uninstallApp(appId: $appId) { appId toolsRemoved seedsTombstoned contributionsRemoved }
}
"#;

pub const WATCH_SUBSCRIPTION: &str = r#"
subscription InspectStandingQuery($queryId: ID!) {
  standingFirings(queryId: $queryId) { queryId sequence occurredAtMs matchedIds receiptId }
}
"#;

pub const REQUIRED_AUTH_HEADERS: [&str; 2] = ["x-api-key", "x-theorem-tenant"];
