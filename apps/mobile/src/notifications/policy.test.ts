import { describe, expect, it } from 'vitest';

import {
  APPROVAL_NOTIFICATION_ACTIONS,
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPolicy,
} from './policy';

describe('notification capability law', () => {
  it('keeps push capabilities quiet by default', () => {
    expect(notificationPolicy({
      kind: 'approval',
      url: 'theorem://tenant/agency.proposal/p-1',
      preferences: DEFAULT_NOTIFICATION_PREFERENCES,
    }).present).toBe(false);
  });

  it('requires both an enabled capability and a prepared destination', () => {
    const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, 'notify:push/approval': true };
    expect(notificationPolicy({ kind: 'approval', preferences }).present).toBe(false);
    expect(notificationPolicy({ kind: 'approval', url: '/proposal/p-1', preferences }).present).toBe(true);
  });

  it('refuses an unchanged dismissed basis', () => {
    const preferences = { ...DEFAULT_NOTIFICATION_PREFERENCES, 'notify:push/approval': true };
    expect(notificationPolicy({
      kind: 'approval',
      url: '/proposal/p-1',
      basisHash: 'basis-a',
      dismissedBasis: new Set(['basis-a']),
      preferences,
    }).present).toBe(false);
  });

  it('offers review only and never a background approval action', () => {
    expect(APPROVAL_NOTIFICATION_ACTIONS.map((action) => action.identifier)).toEqual(['review']);
    expect(APPROVAL_NOTIFICATION_ACTIONS.every((action) => action.options.opensAppToForeground)).toBe(true);
  });
});
