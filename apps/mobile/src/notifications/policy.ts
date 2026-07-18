export type AllowedNotificationKind = 'reminder' | 'approval' | 'mention' | 'run-finished' | 'digest';
export type NotificationCapability =
  | 'notify:digest'
  | 'notify:push/approval'
  | 'notify:push/mention'
  | 'notify:push/run-finished';

export type NotificationPreferences = Record<NotificationCapability, boolean>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  'notify:digest': true,
  'notify:push/approval': false,
  'notify:push/mention': false,
  'notify:push/run-finished': false,
};

export const APPROVAL_NOTIFICATION_ACTIONS = [
  { identifier: 'review', buttonTitle: 'Review', options: { opensAppToForeground: true } },
] as const;

function capabilityFor(kind: AllowedNotificationKind): NotificationCapability | null {
  if (kind === 'approval') return 'notify:push/approval';
  if (kind === 'mention') return 'notify:push/mention';
  if (kind === 'run-finished') return 'notify:push/run-finished';
  if (kind === 'digest') return 'notify:digest';
  return null;
}

export function notificationPolicy(input: {
  kind?: unknown;
  url?: unknown;
  basisHash?: unknown;
  dismissedBasis?: ReadonlySet<string>;
  preferences: NotificationPreferences;
}): { present: boolean; reason: string } {
  if (input.kind === 'reminder') {
    return typeof input.url === 'string'
      ? { present: true, reason: 'explicit reminder' }
      : { present: false, reason: 'no prepared destination' };
  }
  if (
    input.kind !== 'approval' &&
    input.kind !== 'mention' &&
    input.kind !== 'run-finished' &&
    input.kind !== 'digest'
  ) {
    return { present: false, reason: 'kind is not admitted' };
  }
  if (typeof input.url !== 'string' || input.url.length === 0) {
    return { present: false, reason: 'no prepared destination' };
  }
  if (
    typeof input.basisHash === 'string' &&
    input.dismissedBasis?.has(input.basisHash)
  ) {
    return { present: false, reason: 'basis was dismissed' };
  }
  const capability = capabilityFor(input.kind);
  return capability && input.preferences[capability]
    ? { present: true, reason: capability }
    : { present: false, reason: 'capability is quiet' };
}
