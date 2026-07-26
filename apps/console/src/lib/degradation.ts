// SOURCING: none. Pure logic, no upstream component applies.
// SPEC-COMMONPLACE-CONSOLE-SHELL-1.1 CS15: two degradation levels, one
// vocabulary. Wire codes never reach a user. Unmapped codes take a generic
// sentence and report themselves in development.

export type Degradation =
  | { level: 'reduced'; cause: string; detail?: string }
  | { level: 'unavailable'; cause: string; action?: { label: string; run: () => void } };

type DegradationTemplate =
  | { level: 'reduced'; cause: string; detail?: string }
  | { level: 'unavailable'; cause: string; actionLabel?: string };

const WIRE_MAP: Record<string, DegradationTemplate> = {
  console_data_api_unreachable: {
    level: 'unavailable',
    cause: 'The data API is unreachable.',
    actionLabel: 'Reconnect',
  },
  harness_graphql_failed: {
    level: 'unavailable',
    cause: 'The Harness query could not complete.',
    actionLabel: 'Retry',
  },
  harness_graphql_timeout: {
    level: 'unavailable',
    cause: 'The Harness query timed out.',
    actionLabel: 'Retry',
  },
  harness_graphql_unconfigured: {
    level: 'unavailable',
    cause: 'The Harness connection is not configured.',
    actionLabel: 'Open Account',
  },
  harness_graphql_unreachable: {
    level: 'unavailable',
    cause: 'The Harness service is unreachable.',
    actionLabel: 'Retry',
  },
  observed_model_graphql_failed: {
    level: 'unavailable',
    cause: 'The observed model could not be loaded.',
    actionLabel: 'Retry',
  },
  observed_model_graphql_timeout: {
    level: 'unavailable',
    cause: 'The observed model request timed out.',
    actionLabel: 'Retry',
  },
  observed_model_graphql_unconfigured: {
    level: 'unavailable',
    cause: 'The observed model endpoint is not configured.',
    actionLabel: 'Open Account',
  },
  observed_model_graphql_unreachable: {
    level: 'unavailable',
    cause: 'The observed model service is unreachable.',
    actionLabel: 'Retry',
  },
  tenant_object_credential_unavailable: {
    level: 'unavailable',
    cause: 'A tenant credential is required before objects can load.',
    actionLabel: 'Open Account',
  },
  principal_credential_unavailable: {
    level: 'unavailable',
    cause: 'A credential is required before this surface can load.',
    actionLabel: 'Open Account',
  },
  console_chat_wire_failed: {
    level: 'unavailable',
    cause: 'The chat wire could not complete this turn.',
    actionLabel: 'Retry',
  },
  web_search_unavailable: {
    level: 'reduced',
    cause: 'Web search is unavailable.',
    detail: 'Answers continue from local context.',
  },
  trigram: {
    level: 'reduced',
    cause: 'Trigram search is not ready.',
    detail: 'Results may be narrower until the index finishes.',
  },
  vector: {
    level: 'reduced',
    cause: 'Vector search is not ready.',
    detail: 'Semantic ranking is paused until the index finishes.',
  },
  status_graphql: {
    level: 'reduced',
    cause: 'Status reporting is incomplete.',
  },
  standing_queries: {
    level: 'reduced',
    cause: 'Standing queries are not ready.',
  },
  status_digest_projection: {
    level: 'reduced',
    cause: 'The status digest is incomplete.',
  },
  workspace_project_unconnected: {
    level: 'unavailable',
    cause: 'No project is connected to Files.',
    actionLabel: 'Open Workspace',
  },
  harness_memory_projection_unavailable: {
    level: 'unavailable',
    cause: 'Harness Memory is unavailable.',
    actionLabel: 'Open Account',
  },
};

const GENERIC_UNAVAILABLE: DegradationTemplate = {
  level: 'unavailable',
  cause: 'This surface cannot render right now.',
  actionLabel: 'Retry',
};

const GENERIC_REDUCED: DegradationTemplate = {
  level: 'reduced',
  cause: 'Part of this surface is running with reduced capability.',
};

/** Map a wire readiness or error code to a user-facing sentence. */
export function sentenceForCode(code: string): string {
  return WIRE_MAP[code]?.cause ?? GENERIC_UNAVAILABLE.cause;
}

/**
 * Wire code to sentence. An unmapped code renders its generic sentence and
 * reports itself in dev, so a new code is visible without shipping the code.
 */
export function degradationFor(code: string, status?: number): Degradation {
  const normalized = code.trim();
  const mapped = WIRE_MAP[normalized];

  if (!mapped) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[degradation] unmapped wire code', normalized, status ?? null);
    }
    // HTTP-ish failures default to unavailable; readiness-like tokens stay reduced.
    const template =
      typeof status === 'number' && status >= 400
        ? GENERIC_UNAVAILABLE
        : /fail|timeout|unreach|unavail|refus|unauth|unconfig/i.test(normalized)
          ? GENERIC_UNAVAILABLE
          : GENERIC_REDUCED;
    return fromTemplate(template);
  }

  return fromTemplate(mapped);
}

/** Collapse a list of missing capability codes into one reduced marker. */
export function reducedFromMissing(missing: readonly string[]): Degradation | null {
  if (missing.length === 0) return null;
  const causes = missing.map((code) => sentenceForCode(code));
  const unique = [...new Set(causes)];
  return {
    level: 'reduced',
    cause: unique.length === 1 ? unique[0]! : `Reduced capability: ${unique.join('; ')}`,
  };
}

function fromTemplate(template: DegradationTemplate): Degradation {
  if (template.level === 'reduced') {
    return { level: 'reduced', cause: template.cause, detail: template.detail };
  }
  return {
    level: 'unavailable',
    cause: template.cause,
    action: template.actionLabel
      ? { label: template.actionLabel, run: () => undefined }
      : undefined,
  };
}

/** Attach a concrete action runner to an unavailable degradation. */
export function withAction(
  degradation: Degradation,
  run: () => void,
): Degradation {
  if (degradation.level !== 'unavailable' || !degradation.action) return degradation;
  return {
    ...degradation,
    action: { label: degradation.action.label, run },
  };
}
