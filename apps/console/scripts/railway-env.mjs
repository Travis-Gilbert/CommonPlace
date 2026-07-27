// SOURCING: none. Railway startup configuration validation.

/** Fail before the Console server starts when its production data plane is
 * incomplete. Local development does not use the Railway launcher, so its
 * localhost fallback remains available. */
export function assertRailwayEnvironment(environment = process.env) {
  if (!environment.CONSOLE_DATA_API_URL?.trim()) {
    throw new Error(
      'CONSOLE_DATA_API_URL is required for CommonPlace Console Railway startup.',
    );
  }
}
