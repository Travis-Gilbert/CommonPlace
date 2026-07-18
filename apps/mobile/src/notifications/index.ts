/**
 * Notification capability law for the field organ.
 *
 * Push is presentation only. Every interrupt must open a prepared review
 * surface; notification actions never approve, deny, or sign an effect.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushToken } from '@/api/harness';
import { fetchInstanceCapabilities, readInstanceSettings } from '@/api/instance';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  APPROVAL_NOTIFICATION_ACTIONS,
  notificationPolicy,
  type AllowedNotificationKind,
  type NotificationPreferences,
} from './policy';

export {
  DEFAULT_NOTIFICATION_PREFERENCES,
  APPROVAL_NOTIFICATION_ACTIONS,
  notificationPolicy,
  type AllowedNotificationKind,
  type NotificationCapability,
  type NotificationPreferences,
} from './policy';

const PREFERENCES_KEY = 'commonplace.notifications.capabilities.v1';
const DISMISSED_BASIS_KEY = 'commonplace.notifications.dismissed-basis.v1';

export async function readNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
    return raw ? { ...DEFAULT_NOTIFICATION_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_NOTIFICATION_PREFERENCES;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

export async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}

export async function rememberDismissedBasis(basisHash: string): Promise<void> {
  if (!basisHash) return;
  const dismissed = await readDismissedBasis();
  dismissed.add(basisHash);
  await AsyncStorage.setItem(DISMISSED_BASIS_KEY, JSON.stringify([...dismissed].slice(-500)));
}

async function readDismissedBasis(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_BASIS_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data ?? {};
    const [preferences, dismissedBasis] = await Promise.all([
      readNotificationPreferences(),
      readDismissedBasis(),
    ]);
    const policy = notificationPolicy({
      kind: data.kind,
      url: data.url,
      basisHash: data.basis_hash,
      dismissedBasis,
      preferences,
    });
    return {
      shouldShowAlert: policy.present,
      shouldShowBanner: policy.present,
      shouldShowList: policy.present,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

export async function setupNotificationCategories() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('prepared', {
      name: 'Prepared reviews',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: null,
      sound: null,
    });
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: null,
      sound: null,
    });
  }
  await Notifications.setNotificationCategoryAsync('approval', [
    ...APPROVAL_NOTIFICATION_ACTIONS,
  ]);
  await Notifications.setNotificationCategoryAsync('reminder', [
    { identifier: 'snooze', buttonTitle: 'Snooze 10 min', options: { opensAppToForeground: false } },
    { identifier: 'done', buttonTitle: 'Done', options: { opensAppToForeground: false } },
  ]);
}

async function ensurePermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

export async function scheduleReminder(opts: { itemId: string; title: string; remindAtMs: number }) {
  if (opts.remindAtMs <= Date.now() || !(await ensurePermission())) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Reminder',
      body: opts.title,
      categoryIdentifier: 'reminder',
      data: { kind: 'reminder' satisfies AllowedNotificationKind, url: `/object/${opts.itemId}` },
      sound: false,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(opts.remindAtMs) },
  });
}

/** Called only for a run whose Composer request had notify-on-answer enabled. */
export async function presentRunFinished(opts: { title: string; body: string; url: string }) {
  const preferences = await readNotificationPreferences();
  const policy = notificationPolicy({ kind: 'run-finished', url: opts.url, preferences });
  if (!policy.present || !(await ensurePermission())) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      data: { kind: 'run-finished' satisfies AllowedNotificationKind, url: opts.url },
      sound: false,
    },
    trigger: null,
  });
}

export async function snoozeReminder(itemId: string, title: string, minutes = 10) {
  return scheduleReminder({ itemId, title, remindAtMs: Date.now() + minutes * 60_000 });
}

function expoProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
    ?? process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim()
    ?? undefined;
}

export type PushRegistrationResult = {
  code:
    | 'registered'
    | 'simulator'
    | 'permission-denied'
    | 'missing-project-id'
    | 'missing-relay'
    | 'token-error'
    | 'relay-error';
  message: string;
  token?: string;
};

async function relayPushToken(token: string, registrationUrl?: string): Promise<boolean> {
  return registerPushToken(token, Platform.OS, registrationUrl);
}

/** Push requires a physical-device development build and a configured EAS project id. */
export async function registerForPush(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return { code: 'simulator', message: 'Push registration requires a physical device build' };
  }
  if (!(await ensurePermission())) {
    return { code: 'permission-denied', message: 'Notification permission was not granted' };
  }
  const [capabilities, settings] = await Promise.all([
    fetchInstanceCapabilities(),
    readInstanceSettings(),
  ]);
  const projectId = expoProjectId() ?? capabilities.expoProjectId ?? undefined;
  if (!projectId) {
    return { code: 'missing-project-id', message: 'Push needs an EAS project id from the app build or connected node' };
  }
  const registrationUrl = capabilities.pushRegistrationUrl ?? undefined;
  if (!registrationUrl && !settings.harnessUrl?.trim()) {
    return { code: 'missing-relay', message: 'The connected node does not advertise a push registration relay' };
  }
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : 'Expo did not return a push token';
    return { code: 'token-error', message: `Could not create a push token: ${reason}` };
  }
  if (!(await relayPushToken(token, registrationUrl))) {
    return { code: 'relay-error', message: 'The push relay refused this device token', token };
  }
  return { code: 'registered', message: 'Push registered with your node', token };
}

export function startPushTokenRotationListener(): Notifications.EventSubscription {
  if (!Device.isDevice) return { remove() {} };
  return Notifications.addPushTokenListener((token) => {
    void fetchInstanceCapabilities().then((capabilities) => (
      relayPushToken(token.data, capabilities.pushRegistrationUrl ?? undefined)
    ));
  });
}
