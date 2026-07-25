export const CONSOLE_READS = `
query CommonPlaceConsoleSnapshot($root: ID!, $depth: Int!, $receiptLimit: Int!) {
  consoleOverview { countsByType { nodeType count } generation readiness { capability state detail } }
  consoleEntities { record merges receipts candidates }
  consoleReceipts(first: $receiptLimit) { receipts nextCursor total }
  consoleNeighborhood(root: $root, depth: $depth) { root depth nodes edges }
  standingQueries { id name shape enabled }
  standingFirings(limit: 50) { queryId sequence occurredAtMs matchedIds receiptId }
}
`;

export const PLUGIN_STATE = `
query CommonPlaceConsolePluginState {
  installedApps { appId version state requiredConformanceLevel contributions { point block kind value } grants }
  pendingApps { appId version state draftedBy requiredConformanceLevel contributions { point block kind value } contributionsActive grants manifest }
}
`;

export const PLUGIN_CONSENT = `
mutation ConsentCommonPlaceConsole($appId: String!) {
  consentApp(appId: $appId) { appId toolsAdded seedsCreated contributions grants }
}
`;

export const PLUGIN_DENY = `
mutation DenyCommonPlaceConsole($appId: String!) {
  denyApp(appId: $appId) { appId draftNodeId draftRemoved contributionsRemoved grantsDeclined }
}
`;

export const PLUGIN_UNINSTALL = `
mutation UninstallCommonPlaceConsole($appId: String!) {
  uninstallApp(appId: $appId) { appId toolsRemoved seedsTombstoned contributionsRemoved }
}
`;

export const WATCH_SUBSCRIPTION = `
subscription InspectStandingQuery($queryId: ID!) {
  standingFirings(queryId: $queryId) { queryId sequence occurredAtMs matchedIds receiptId }
}
`;
