/**
 * Notification ethics, enforced as law (SPEC-MOBILE-APP D6):
 * notifications fire ONLY for
 *   1. explicit time reminders,
 *   2. approvals,
 *   3. direct @-mentions,
 *   4. run-finished when the user asked to be told.
 * Resurfacing never notifies. No engagement notifications. No icon badge, ever.
 *
 * Every schedule/present call in the app goes through this module; nothing else
 * imports expo-notifications directly.
 */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken } from '@/api/harness';

export type AllowedNotificationKind = 'reminder' | 'approval' | 'mention' | 'run-finished';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false, // the ethics: no icon badge, ever
  }),
});

export async function setupNotificationCategories() {
  await Notifications.setNotificationCategoryAsync('approval', [
    { identifier: 'approve', buttonTitle: 'Approve', options: { opensAppToForeground: false } },
    { identifier: 'deny', buttonTitle: 'Deny', options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync('reminder', [
    { identifier: 'snooze', buttonTitle: 'Snooze 10 min', options: { opensAppToForeground: false } },
    { identifier: 'done', buttonTitle: 'Done', options: { opensAppToForeground: false } },
  ]);
}

async function ensurePermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Schedule a local reminder at remindAtMs, deep-linked to the object. */
export async function scheduleReminder(opts: { itemId: string; title: string; remindAtMs: number }) {
  if (opts.remindAtMs <= Date.now()) return null;
  if (!(await ensurePermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminder',
      body: opts.title,
      categoryIdentifier: 'reminder',
      data: { kind: 'reminder' satisfies AllowedNotificationKind, url: `/object/${opts.itemId}` },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(opts.remindAtMs) },
  });
}

/** Present run-finished ONLY when the user asked to be told (omnibar toggle). */
export async function presentRunFinished(opts: { title: string; body: string; url: string }) {
  if (!(await ensurePermission())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      data: { kind: 'run-finished' satisfies AllowedNotificationKind, url: opts.url },
    },
    trigger: null,
  });
}

export async function snoozeReminder(itemId: string, title: string, minutes = 10) {
  return scheduleReminder({ itemId, title, remindAtMs: Date.now() + minutes * 60_000 });
}

/** Expo push registration; token relayed to the harness node for approvals/mentions. */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (!(await ensurePermission())) return null;
  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await registerPushToken(token, Platform.OS);
    return token;
  } catch {
    return null;
  }
}
