/**
 * The avatar sheet: profile, instance switcher (cloud default, local URL with
 * probe, saved per the existing web pattern), tokens in expo-secure-store,
 * notification preferences, machine-surface retheme, sign out. Sign-out wipes
 * the local queue only after it drains or the user confirms discard (D7).
 */
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DEFAULT_LOCAL_URL,
  DEFAULT_SETTINGS,
  invalidateInstanceCache,
  probeInstance,
  readInstanceSettings,
  saveInstanceSettings,
  type InstanceSettings,
} from '@/api/instance';
import { clearQueue, drainQueue, pendingCount } from '@/capture/queue';
import { AppText } from '@/components/AppText';
import { PressableSurface } from '@/components/PressableSurface';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  readNotificationPreferences,
  registerForPush,
  saveNotificationPreferences,
  type NotificationCapability,
  type NotificationPreferences,
} from '@/notifications';
import { useTheme, useThemePrefs } from '@/theme/ThemeProvider';

function Field({
  label,
  value,
  onChange,
  placeholder,
  secure,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  secure?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={styles.field}>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.c.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secure}
        style={[styles.input, { color: t.c.text, backgroundColor: t.c.muted, borderCurve: 'continuous' }]}
        maxFontSizeMultiplier={1.4}
      />
    </View>
  );
}

export default function AccountScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { prefs, setPrefs } = useThemePrefs();
  const [s, setS] = useState<InstanceSettings>(DEFAULT_SETTINGS);
  const [probe, setProbe] = useState<string | null>(null);
  const [pushState, setPushState] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );

  useEffect(() => {
    readInstanceSettings().then(setS);
    readNotificationPreferences().then(setNotificationPreferences);
  }, []);

  const patch = (p: Partial<InstanceSettings>) => setS((cur) => ({ ...cur, ...p }));

  function patchNotification(capability: NotificationCapability, value: boolean) {
    const next = { ...notificationPreferences, [capability]: value };
    setNotificationPreferences(next);
    void saveNotificationPreferences(next);
  }

  async function connect() {
    setProbe('Probing...');
    const res = await probeInstance(s.url, s.apiKey);
    if (res.ok) {
      await saveInstanceSettings(s);
      invalidateInstanceCache();
      await saveInstanceSettings(s);
      setProbe('Connected');
      void drainQueue();
    } else {
      setProbe(`Failed: ${res.error}`);
    }
  }

  async function saveOnly() {
    await saveInstanceSettings(s);
    setProbe('Saved');
  }

  function signOut() {
    const pending = pendingCount();
    const wipe = async () => {
      clearQueue();
      await saveInstanceSettings({ ...DEFAULT_SETTINGS });
      invalidateInstanceCache();
      setS(DEFAULT_SETTINGS);
      setProbe(null);
      router.back();
    };
    if (pending > 0) {
      Alert.alert(
        'Unsynced captures',
        `${pending} capture${pending === 1 ? ' is' : 's are'} still on this phone. Drain them first, or discard them?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Drain first',
            onPress: () => {
              void drainQueue().then(() => {
                if (pendingCount() === 0) void wipe();
                else Alert.alert('Still pending', 'Some captures could not sync. Connect first or discard.');
              });
            },
          },
          { text: 'Discard and sign out', style: 'destructive', onPress: () => void wipe() },
        ],
      );
    } else {
      void wipe();
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: t.c.raised }]}>
      <View style={[styles.topbar, { paddingTop: insets.top + 6 }]}>
        <AppText variant="display2">Account</AppText>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close">
          <Ionicons name="chevron-down" size={24} color={t.c.text} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <AppText variant="headline">Instance</AppText>
        <View style={[styles.segment, { backgroundColor: t.c.muted, borderCurve: 'continuous' }]}>
          {(['cloud', 'self-hosted'] as const).map((mode) => (
            <Pressable
              key={mode}
              onPress={() => patch({ mode, url: mode === 'self-hosted' && !s.url ? DEFAULT_LOCAL_URL : s.url })}
              style={[styles.segmentItem, s.mode === mode && { backgroundColor: t.c.raised, borderCurve: 'continuous' }]}
            >
              <AppText variant="caption" style={{ color: s.mode === mode ? t.c.text : t.c.textMuted }}>
                {mode === 'cloud' ? 'Cloud' : 'Local node'}
              </AppText>
            </Pressable>
          ))}
        </View>
        <Field label="Node URL" value={s.url} onChange={(url) => patch({ url })} placeholder={DEFAULT_LOCAL_URL} />
        <Field label="API key" value={s.apiKey} onChange={(apiKey) => patch({ apiKey })} secure placeholder="x-api-key" />
        <View style={styles.row}>
          <PressableSurface
            onPress={() => void connect()}
            style={[styles.btn, { backgroundColor: t.c.primary, borderCurve: 'continuous' }]}
            pressedStyle={{ backgroundColor: t.c.primaryPressed }}
          >
            <AppText variant="caption" tone="onPrimary">
              Probe and connect
            </AppText>
          </PressableSurface>
          <PressableSurface
            onPress={() => void saveOnly()}
            style={[styles.btn, { backgroundColor: t.c.secondary, borderCurve: 'continuous' }]}
            pressedStyle={{ backgroundColor: t.c.muted }}
          >
            <AppText variant="caption">Save</AppText>
          </PressableSurface>
          {probe ? (
            <AppText variant="caption" tone={probe === 'Connected' ? 'primary' : 'muted'}>
              {probe}
            </AppText>
          ) : null}
        </View>
        <Field
          label="Approval signature reference"
          value={s.userSignatureRef ?? ''}
          onChange={(userSignatureRef) => patch({ userSignatureRef })}
          placeholder="keychain:commonplace-mobile"
          secure
        />
        <AppText variant="caption" tone="muted">
          Approval is hidden until the live agency kernel can bind this reference to a fresh preflight. The key itself never enters the app bundle.
        </AppText>

        <AppText variant="headline" style={{ marginTop: 16 }}>
          Scenes and rooms
        </AppText>
        <Field
          label="Gateway URL (scenes, graph lens)"
          value={s.gatewayUrl ?? ''}
          onChange={(gatewayUrl) => patch({ gatewayUrl })}
          placeholder="http://192.168.x.x:8080"
        />
        <Field
          label="Harness node URL (rooms)"
          value={s.harnessUrl ?? ''}
          onChange={(harnessUrl) => patch({ harnessUrl })}
          placeholder="http://192.168.x.x:50080"
        />
        <Field
          label="Hosted ACP chat URL"
          value={s.chatUrl ?? ''}
          onChange={(chatUrl) => patch({ chatUrl })}
          placeholder="https://your-console.example/api/chat/stream"
        />
        <AppText variant="caption" tone="muted">
          Chat names this capability as unavailable when the ACP route is absent. It never substitutes a different agent path.
        </AppText>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Tenant" value={s.tenant ?? ''} onChange={(tenant) => patch({ tenant })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Actor id" value={s.actorId ?? ''} onChange={(actorId) => patch({ actorId })} />
          </View>
        </View>

        <AppText variant="headline" style={{ marginTop: 16 }}>
          Notifications
        </AppText>
        <AppText variant="caption" tone="muted">
          Reminder times you set are always local. Every other interrupt is a separate capability and opens a
          prepared review surface. Notification actions cannot approve or sign, sound is quiet, and there is no badge.
        </AppText>
        {(
          [
            ['notify:digest', 'Prepared digest'],
            ['notify:push/approval', 'Approval ready for review'],
            ['notify:push/mention', 'Direct mentions'],
            ['notify:push/run-finished', 'Requested run finished'],
          ] as const
        ).map(([capability, label]) => (
          <View key={capability} style={styles.preferenceRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption">{label}</AppText>
              <AppText variant="micro" tone="faint" style={{ fontFamily: t.speakerFonts.machine }}>
                {capability}
              </AppText>
            </View>
            <Switch
              value={notificationPreferences[capability]}
              onValueChange={(value) => patchNotification(capability, value)}
              trackColor={{ false: t.c.border, true: t.c.primary }}
            />
          </View>
        ))}
        <PressableSurface
          onPress={() => {
            setPushState('Registering...');
            void registerForPush().then((token) => setPushState(token ? 'Push registered with your node' : 'Push unavailable'));
          }}
          style={[styles.btn, { backgroundColor: t.c.secondary, alignSelf: 'flex-start', borderCurve: 'continuous' }]}
          pressedStyle={{ backgroundColor: t.c.muted }}
        >
          <AppText variant="caption">Register enabled push capabilities</AppText>
        </PressableSurface>
        {pushState ? (
          <AppText variant="caption" tone="muted">
            {pushState}
          </AppText>
        ) : null}

        <AppText variant="headline" style={{ marginTop: 16 }}>
          Machine surfaces
        </AppText>
        <View style={[styles.segment, { backgroundColor: t.c.muted, borderCurve: 'continuous' }]}>
          {(
            [
              ['umber', 'Umber'],
              ['deepTeal', 'Deep teal'],
            ] as const
          ).map(([key, label]) => (
            <Pressable
              key={key}
              onPress={() => setPrefs({ ...prefs, machineSurface: key })}
              style={[styles.segmentItem, prefs.machineSurface === key && { backgroundColor: t.c.raised, borderCurve: 'continuous' }]}
            >
              <AppText variant="caption" style={{ color: prefs.machineSurface === key ? t.c.text : t.c.textMuted }}>
                {label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <PressableSurface
          onPress={signOut}
          style={[
            styles.btn,
            {
              backgroundColor: 'transparent',
              borderWidth: 1,
              borderColor: t.c.border,
              alignSelf: 'flex-start',
              marginTop: 24,
              borderCurve: 'continuous',
            },
          ]}
          pressedStyle={{ backgroundColor: t.c.muted }}
        >
          <AppText variant="caption">Sign out</AppText>
        </PressableSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 4 },
  body: { padding: 16, gap: 10, paddingBottom: 64 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  field: { gap: 4 },
  input: { height: 42, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { paddingHorizontal: 14, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  preferenceRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
